import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Déclarer un MJ disponible sur un créneau. */
export class DeclareAvailability {
  constructor(private readonly repository: ConventionRepository) {}

  execute(gameMasterId: string, timeSlotId: string): Promise<void> {
    return changeConvention(this.repository, (convention) =>
      convention.declareGameMasterAvailability(gameMasterId, timeSlotId),
    );
  }
}
