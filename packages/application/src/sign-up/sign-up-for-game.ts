import type { Clock } from '../clock.js';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneRepository } from '../linked-phone/linked-phone-repository.js';
import { PhoneNotLinkedError } from '../linked-phone/phone-not-linked.error.js';
import type { NotificationSender } from '../notification/notification-sender.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/**
 * S'inscrire à une partie (IN-2), pour le pseudo du téléphone relié, et prévenir ses autres inscrits
 * si elle passe en très demandée (NO-2). Une inscription répétée ne sauvegarde rien.
 */
export class SignUpForGame {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly phones: LinkedPhoneRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly notifications: NotificationSender,
    private readonly clock: Clock,
  ) {}

  /** `phoneId` : le cookie du téléphone. Sans cookie, ou relié à aucun pseudo : `PhoneNotLinkedError`. */
  async execute(phoneId: string | null, gameId: string): Promise<void> {
    const phone = phoneId ? await this.phones.find(phoneId) : null;
    const catalogue = await this.scenarios.catalogue();
    const notifications = await changeConvention(
      this.conventions,
      (convention) => {
        convention.verifyStillOpenAt(this.clock.now());
        if (!phone) throw new PhoneNotLinkedError();
        return convention.signUpForGame(phone.participantId, gameId, catalogue);
      },
      (result) => result !== null,
    );
    this.notifications.send(notifications ?? []);
  }
}
