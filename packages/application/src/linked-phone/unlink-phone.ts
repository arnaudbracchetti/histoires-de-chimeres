import type { Clock } from '../clock.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneRepository } from './linked-phone-repository.js';

/**
 * Changer de pseudo (ID-9) : coupe le lien de ce téléphone, et rien d'autre. Le pseudo garde ses
 * inscriptions et ses autres téléphones.
 */
export class UnlinkPhone {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly phones: LinkedPhoneRepository,
    private readonly clock: Clock,
  ) {}

  /** `phoneId` : le cookie du téléphone ; sans cookie, rien à couper. */
  async execute(phoneId: string | null): Promise<void> {
    (await this.conventions.get()).verifyOpenAt(this.clock.now());
    if (phoneId) await this.phones.unlink(phoneId);
  }
}
