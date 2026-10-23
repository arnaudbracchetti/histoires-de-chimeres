import type { MoveGameBody } from '@chimeres/contract';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Déplacer une partie sur un autre créneau ou une autre table (PR-17, PR-5). */
export class MoveGame {
  constructor(private readonly repository: ConventionRepository) {}

  execute(gameId: string, { timeSlotId, tableId }: MoveGameBody): Promise<void> {
    return changeConvention(this.repository, (convention) =>
      convention.moveGame(gameId, timeSlotId, tableId),
    );
  }
}
