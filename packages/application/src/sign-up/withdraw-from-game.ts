import type { Clock } from '../clock.js';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneRepository } from '../linked-phone/linked-phone-repository.js';
import { PhoneNotLinkedError } from '../linked-phone/phone-not-linked.error.js';

/**
 * Se désinscrire d'une partie (IN-2), pour le pseudo du téléphone relié. Retirer une inscription
 * absente ne sauvegarde rien.
 */
export class WithdrawFromGame {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly phones: LinkedPhoneRepository,
    private readonly clock: Clock,
  ) {}

  /** `phoneId` : le cookie du téléphone. Sans cookie, ou relié à aucun pseudo : `PhoneNotLinkedError`. */
  async execute(phoneId: string | null, gameId: string): Promise<void> {
    const phone = phoneId ? await this.phones.find(phoneId) : null;
    await changeConvention(
      this.conventions,
      (convention) => {
        convention.verifyOpenAt(this.clock.now());
        if (!phone) throw new PhoneNotLinkedError();
        return convention.withdraw(phone.participantId, gameId);
      },
      (changed) => changed,
    );
  }
}
