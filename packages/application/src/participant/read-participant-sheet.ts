import type { ParticipantResultDto, ParticipantSheetDto } from '@chimeres/contract';
import type { ParticipantResult } from '@chimeres/domain';
import type { AccountRepository } from '../account/account-repository.js';
import type { Clock } from '../clock.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScheduleReader } from '../game/schedule-reader.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';
import { toParticipantAccountDto } from './participant-account-dto.js';
import type { ParticipantReader } from './participant-reader.js';

/**
 * La fiche d'un pseudo (ID-5) : son résultat sur chaque créneau, que la convention calcule avec le
 * catalogue entier, tirage provisoire compris, ses inscriptions, actives et de secours, d'après sa
 * situation, ses téléphones reliés et ses rôles (ID-16).
 */
export class ReadParticipantSheet {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly schedule: ScheduleReader,
    private readonly reader: ParticipantReader,
    private readonly clock: Clock,
    private readonly accounts: AccountRepository,
  ) {}

  /** La fiche, ou `null` si le pseudo n'existe pas. */
  async execute(participantId: string): Promise<ParticipantSheetDto | null> {
    const convention = await this.conventions.get();
    const participant = convention.participants.find(({ id }) => id === participantId);
    // Un pseudo inconnu, même d'un id mal formé, ne va pas jusqu'à la lecture de ses téléphones.
    if (!participant) return null;
    const [catalogue, games, linkedPhones, account] = await Promise.all([
      this.scenarios.catalogue(),
      this.schedule.games(),
      this.reader.listLinkedPhones(participant.id),
      this.accounts.findByParticipantId(participant.id),
    ]);
    const titles = new Map(games.map(({ id, scenario }) => [id, scenario.title]));
    const findGameTitle = (gameId: string) => titles.get(gameId)!;
    const now = this.clock.now();
    const situation = convention.computeParticipantSituation(participant.id, now);
    const situationSlots = new Map(situation.timeSlots.map((slot) => [slot.timeSlotId, slot]));
    return {
      id: participant.id,
      nickname: participant.nickname.text,
      gameMaster: convention.isParticipantGameMaster(participant.id),
      organizer: account?.isOrganizer ?? false,
      account: account && toParticipantAccountDto(account, convention, now),
      signedUpGameIds: situation.signedUpGameIds,
      backupGameIds: situation.backupGameIds,
      timeSlots: convention
        .computeParticipantResults(participant.id, now, catalogue)
        .map(({ timeSlotId, state, result }) => ({
          timeSlotId,
          rank: convention.getTimeSlotRank(timeSlotId),
          state,
          result: toResultDto(result, findGameTitle),
          ledGameId: situationSlots.get(timeSlotId)!.ledGameId,
          withoutGame: situationSlots.get(timeSlotId)!.withoutGame,
          latecomerAdditionAllowed: convention.isLatecomerAdditionAllowed(
            participant.id,
            timeSlotId,
            now,
          ),
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
