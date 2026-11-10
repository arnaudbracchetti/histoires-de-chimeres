import type { MergeVerdictDto } from '@chimeres/contract';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScheduleReader } from '../game/schedule-reader.js';

/**
 * Ce que la fusion d'un pseudo dans un autre fera, créneau par créneau (ID-11), que la convention
 * calcule comme la fusion, les parties désignées par leur titre et leur table.
 */
export class ReadMergeVerdict {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly schedule: ScheduleReader,
  ) {}

  /** Un pseudo inconnu, ou une fusion refusée, est un refus du domaine. */
  async execute(sourceId: string, destinationId: string): Promise<MergeVerdictDto> {
    const convention = await this.conventions.get();
    const verdict = convention.computeMergeVerdict(sourceId, destinationId);
    const games = new Map((await this.schedule.games()).map((game) => [game.id, game]));
    const tableNames = new Map(convention.tables.map(({ id, name }) => [id, name.text]));
    const titleOf = (gameId: string) => games.get(gameId)!.scenario.title;
    return {
      timeSlots: verdict.map(({ assignment, ...slot }) => ({
        timeSlotId: slot.timeSlotId,
        rank: convention.getTimeSlotRank(slot.timeSlotId),
        assignment: assignment && {
          title: assignment.gameId && titleOf(assignment.gameId),
          tableName: assignment.gameId && tableNames.get(games.get(assignment.gameId)!.tableId)!,
          outcome: assignment.outcome,
        },
        destinationLeavesDraw: slot.destinationLeavesDraw,
        transferredSignUpTitles: slot.transferredSignUpGameIds.map(titleOf),
        lostSignUpTitles: slot.lostSignUpGameIds.map(titleOf),
        withoutGame: slot.withoutGame,
      })),
    };
  }
}
