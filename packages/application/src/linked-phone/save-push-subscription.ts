import type { PushSubscriptionBody } from '@chimeres/contract';
import type { Clock } from '../clock.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneRepository } from './linked-phone-repository.js';
import { PhoneNotLinkedError } from './phone-not-linked.error.js';

/**
 * Ranger l'abonnement push du téléphone relié, renvoyé à chaque ouverture et après chaque
 * liaison : les notifications partiront vers lui (NO-1).
 */
export class SavePushSubscription {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly phones: LinkedPhoneRepository,
    private readonly clock: Clock,
  ) {}

  /** `phoneId` : le cookie du téléphone. Sans cookie, ou relié à aucun pseudo : `PhoneNotLinkedError`. */
  async execute(phoneId: string | null, subscription: PushSubscriptionBody): Promise<void> {
    (await this.conventions.get()).verifyOpenAt(this.clock.now());
    const phone = phoneId ? await this.phones.find(phoneId) : null;
    if (!phone) throw new PhoneNotLinkedError();
    await this.phones.savePushSubscription(phone.id, subscription);
  }
}
