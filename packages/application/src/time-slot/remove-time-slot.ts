import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Supprimer un créneau. */
export class RemoveTimeSlot {
  constructor(private readonly repository: ConventionRepository) {}

  execute(timeSlotId: string): Promise<void> {
    return changeConvention(this.repository, (convention) => convention.removeTimeSlot(timeSlotId));
  }
}
