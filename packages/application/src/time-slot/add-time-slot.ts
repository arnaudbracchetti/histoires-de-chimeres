import type { TimeSlotHoursBody } from '@chimeres/contract';
import { TimeOfDay } from '@chimeres/domain';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Ajouter un créneau à la journée. */
export class AddTimeSlot {
  /** `newId` donne l'identifiant du créneau : le domaine ne génère rien. */
  constructor(
    private readonly repository: ConventionRepository,
    private readonly newId: () => string,
  ) {}

  execute({ start, end }: TimeSlotHoursBody): Promise<void> {
    const id = this.newId();
    return changeConvention(this.repository, (convention) =>
      convention.addTimeSlot(id, TimeOfDay.parse(start), TimeOfDay.parse(end)),
    );
  }
}
