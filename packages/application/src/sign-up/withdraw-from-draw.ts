import type { Clock } from '../clock.js';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneRepository } from '../linked-phone/linked-phone-repository.js';
import { PhoneNotLinkedError } from '../linked-phone/phone-not-linked.error.js';

/**
 * Se retirer du tirage d'un créneau, pour le pseudo sans partie du téléphone relié. Sans cet état,
 * rien n'est sauvegardé.
 */
export class WithdrawFromDraw {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly phones: LinkedPhoneRepository,
    private readonly clock: Clock,
  ) {}

  /** `phoneId` : le cookie du téléphone. Sans cookie, ou relié à aucun pseudo : `PhoneNotLinkedError`. */
  async execute(phoneId: string | null, timeSlotId: string): Promise<void> {
    const phone = phoneId ? await this.phones.find(phoneId) : null;
    await changeConvention(
      this.conventions,
      (convention) => {
        convention.verifyStillOpenAt(this.clock.now());
        if (!phone) throw new PhoneNotLinkedError();
        return convention.withdrawFromDraw(phone.participantId, timeSlotId);
      },
      (changed) => changed,
    );
  }
}
