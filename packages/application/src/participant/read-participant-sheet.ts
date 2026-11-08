import type { ParticipantResultDto, ParticipantSheetDto } from '@chimeres/contract';
import type { ParticipantResult } from '@chimeres/domain';
import type { Clock } from '../clock.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScheduleReader } from '../game/schedule-reader.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';
import type { ParticipantReader } from './participant-reader.js';

/**
 * La fiche d'un pseudo (ID-5) : son résultat sur chaque créneau, que la convention calcule avec le
 * catalogue entier, tirage provisoire compris, et ses téléphones reliés.
 */
export class ReadParticipantSheet {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly schedule: ScheduleReader,
    private readonly reader: ParticipantReader,
    private readonly clock: Clock,
  ) {}

  /** La fiche, ou `null` si le pseudo n'existe pas. */
  async execute(participantId: string): Promise<ParticipantSheetDto | null> {
    const convention = await this.conventions.get();
    const participant = convention.participants.find(({ id }) => id === participantId);
    // Un pseudo inconnu, même d'un id mal formé, ne va pas jusqu'à la lecture de ses téléphones.
    if (!participant) return null;
    const [catalogue, games, linkedPhones] = await Promise.all([
      this.scenarios.catalogue(),
      this.schedule.games(),
      this.reader.listLinkedPhones(participant.id),
    ]);
    const titles = new Map(games.map(({ id, scenario }) => [id, scenario.title]));
    const findGameTitle = (gameId: string) => titles.get(gameId)!;
    return {
      id: participant.id,
      nickname: participant.nickname.text,
      gameMaster: convention.gameMasters.some(
        (gameMaster) => gameMaster.participant.id === participant.id,
      ),
      timeSlots: convention
        .computeParticipantResults(participant.id, this.clock.now(), catalogue)
        .map(({ timeSlotId, state, result }) => ({
          timeSlotId,
          rank: convention.getTimeSlotRank(timeSlotId),
          state,
          result: toResultDto(result, findGameTitle),
        })),
      linkedPhones,
    };
  }
}

/** Le résultat, la partie désignée par son titre. */
function toResultDto(
  result: ParticipantResult,
  findGameTitle: (gameId: string) => string,
): ParticipantResultDto {
  if (result.kind !== 'assigned' && result.kind !== 'leading') return result;
  const { gameId, ...rest } = result;
  return { ...rest, title: findGameTitle(gameId) };
}
