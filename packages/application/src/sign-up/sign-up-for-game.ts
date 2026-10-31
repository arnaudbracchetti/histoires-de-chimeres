import type { Clock } from '../clock.js';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneRepository } from '../linked-phone/linked-phone-repository.js';
import { PhoneNotLinkedError } from '../linked-phone/phone-not-linked.error.js';

/**
 * S'inscrire à une partie (IN-2), pour le pseudo du téléphone relié. Une inscription répétée ne
 * sauvegarde rien.
 */
export class SignUpForGame {
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
        convention.verifyStillOpenAt(this.clock.now());
        if (!phone) throw new PhoneNotLinkedError();
        return convention.signUpForGame(phone.participantId, gameId);
      },
      (changed) => changed,
    );
  }
}
