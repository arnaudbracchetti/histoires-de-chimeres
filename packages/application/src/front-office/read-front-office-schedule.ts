import type { FrontOfficeScheduleDto } from '@chimeres/contract';
import type { Clock } from '../clock.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneReader } from '../linked-phone/linked-phone-reader.js';
import { PhoneNotLinkedError } from '../linked-phone/phone-not-linked.error.js';
import type { FrontOfficeScheduleReader } from './front-office-schedule-reader.js';

/** Le programme du front office, servi au seul téléphone relié, tant que la convention n'est pas terminée. */
export class ReadFrontOfficeSchedule {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly phones: LinkedPhoneReader,
    private readonly schedule: FrontOfficeScheduleReader,
    private readonly clock: Clock,
  ) {}

  /** `phoneId` : le cookie du téléphone. Sans cookie, ou relié à aucun pseudo : `PhoneNotLinkedError`. */
  async execute(phoneId: string | null): Promise<FrontOfficeScheduleDto> {
    (await this.conventions.get()).verifyStillOpenAt(this.clock.now());
    if (!phoneId || !(await this.phones.read(phoneId))) throw new PhoneNotLinkedError();
    return this.schedule.read();
  }
}
