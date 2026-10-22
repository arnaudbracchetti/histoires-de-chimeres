import type { TimeSlotHoursBody } from '@chimeres/contract';
import { TimeOfDay } from '@chimeres/domain';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Changer les heures d'un créneau. */
export class ChangeTimeSlotHours {
  constructor(private readonly repository: ConventionRepository) {}

  execute(timeSlotId: string, { start, end }: TimeSlotHoursBody): Promise<void> {
    return changeConvention(this.repository, (convention) =>
      convention.changeTimeSlotHours(timeSlotId, TimeOfDay.parse(start), TimeOfDay.parse(end)),
    );
  }
}
