import type { ParticipantListEntryDto, TimeSlotStateDto } from '@chimeres/contract';
import { ComparableName } from '@chimeres/domain';
import type { Clock } from '../clock.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ParticipantReader, ParticipantRecord } from './participant-reader.js';

/**
 * La liste « Participants » (ID-5) : les pseudos que la recherche trouve, avec leurs inscriptions
 * par créneau, et l'état de chaque créneau à cet instant, terminé compris, que la convention calcule.
 */
export class ReadParticipantList {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly reader: ParticipantReader,
    private readonly clock: Clock,
  ) {}

  /**
   * `search` : une partie du pseudo ou du titre d'une partie où il est inscrit, selon ID-7. Vide ou
   * absente, tous les pseudos.
   */
  async execute(search: string | undefined): Promise<ParticipantListEntryDto[]> {
    const [convention, participants] = await Promise.all([
      this.conventions.get(),
      this.reader.list(),
    ]);
    const now = this.clock.now();
    const timeSlots = convention.timeSlots.map(({ id }) => ({
      timeSlotId: id,
      rank: convention.getTimeSlotRank(id),
      state: convention.computeTimeSlotStateAt(id, now),
    }));
    const fragment = search?.trim() ? ComparableName.createFromText(search) : null;
    return participants.flatMap((participant) => {
      const match = fragment ? findMatch(participant, fragment) : { title: null };
      return match ? [buildEntry(participant, timeSlots, match.title)] : [];
    });
  }
}

/**
 * Ce qui fait trouver le pseudo : son pseudo (`title` à `null`), sinon le titre de la première de
 * ses inscriptions qui contient le fragment ; `null` s'il n'est pas trouvé.
 */
function findMatch(
  { nickname, signUps }: ParticipantRecord,
  fragment: ComparableName,
): { title: string | null } | null {
  if (ComparableName.createFromText(nickname).contains(fragment)) return { title: null };
  const signUp = signUps.find(({ title }) =>
    ComparableName.createFromText(title).contains(fragment),
  );
  return signUp ? { title: signUp.title } : null;
}

/** La ligne du pseudo : ses inscriptions comptées sur chaque créneau, dans l'ordre de la journée. */
function buildEntry(
  { signUps, ...participant }: ParticipantRecord,
  timeSlots: { timeSlotId: string; rank: number; state: TimeSlotStateDto }[],
  matchedGameTitle: string | null,
): ParticipantListEntryDto {
  return {
    ...participant,
    signUpCounts: timeSlots.map((slot) => ({
      ...slot,
      count: signUps.filter(({ timeSlotId }) => timeSlotId === slot.timeSlotId).length,
    })),
    matchedGameTitle,
  };
}
