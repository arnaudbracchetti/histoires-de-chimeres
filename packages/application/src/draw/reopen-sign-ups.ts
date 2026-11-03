import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Rouvrir les inscriptions d'un créneau en tirage provisoire (TI-6). Aucune notification. */
export class ReopenSignUps {
  constructor(private readonly conventions: ConventionRepository) {}

  async execute(timeSlotId: string): Promise<void> {
    await changeConvention(this.conventions, (convention) =>
      convention.reopenSignUps(timeSlotId),
    );
  }
}
