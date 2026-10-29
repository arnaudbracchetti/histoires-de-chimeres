import type { LinkedPhoneDto } from '@chimeres/contract';
import type { Clock } from '../clock.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneReader } from './linked-phone-reader.js';
import { PhoneNotLinkedError } from './phone-not-linked.error.js';

/** Le pseudo du téléphone, tant que la convention n'est pas terminée. */
export class ReadLinkedPhone {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly reader: LinkedPhoneReader,
    private readonly clock: Clock,
  ) {}

  /** `phoneId` : le cookie du téléphone. Sans cookie, ou relié à aucun pseudo : `PhoneNotLinkedError`. */
  async execute(phoneId: string | null): Promise<LinkedPhoneDto> {
    (await this.conventions.get()).verifyOpenAt(this.clock.now());
    const phone = phoneId ? await this.reader.read(phoneId) : null;
    if (!phone) throw new PhoneNotLinkedError();
    return phone;
  }
}
