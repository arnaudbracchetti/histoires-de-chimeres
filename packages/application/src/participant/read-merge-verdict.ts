import type { MergeVerdictDto } from '@chimeres/contract';
import type { AccountRepository } from '../account/account-repository.js';
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
    private readonly accounts: AccountRepository,
  ) {}

  /** Un pseudo inconnu, ou une fusion refusée, est un refus du domaine. */
  async execute(sourceId: string, destinationId: string): Promise<MergeVerdictDto> {
    const accounts = await this.accounts.list();
    const convention = await this.conventions.get();
    const verdict = convention.computeMergeVerdict(sourceId, destinationId, accounts);
    const tableNames = new Map(convention.tables.map(({ id, name }) => [id, name.text]));
    const games = new Map(
      (await this.schedule.games()).map(({ id, scenario, tableId }) => [
        id,
        { title: scenario.title, tableName: tableNames.get(tableId)! },
      ]),
    );
    const findGame = (gameId: string) => games.get(gameId)!;
    const listTitles = (gameIds: string[]) => gameIds.map((gameId) => findGame(gameId).title);
    return {
      timeSlots: verdict.map(({ assignment, ...slot }) => ({
        timeSlotId: slot.timeSlotId,
        rank: convention.getTimeSlotRank(slot.timeSlotId),
        assignment: assignment && {
          ...(assignment.gameId ? findGame(assignment.gameId) : { title: null, tableName: null }),
          outcome: assignment.outcome,
        },
        destinationLeavesDraw: slot.destinationLeavesDraw,
        transferredSignUpTitles: listTitles(slot.transferredSignUpGameIds),
        backupSignUpTitles: listTitles(slot.backupSignUpGameIds),
        lostSignUpTitles: listTitles(slot.lostSignUpGameIds),
        withoutGame: slot.withoutGame,
      })),
    };
  }
}
