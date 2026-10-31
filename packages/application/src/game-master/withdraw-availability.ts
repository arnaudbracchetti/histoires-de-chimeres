import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Retirer la disponibilité d'un MJ sur un créneau. */
export class WithdrawAvailability {
  constructor(private readonly repository: ConventionRepository) {}

  execute(gameMasterId: string, timeSlotId: string): Promise<void> {
    return changeConvention(this.repository, (convention) =>
      convention.withdrawGameMasterAvailability(gameMasterId, timeSlotId),
    );
  }
}
