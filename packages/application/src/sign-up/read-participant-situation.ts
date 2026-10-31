import type { ParticipantSituationDto } from '@chimeres/contract';
import type { Clock } from '../clock.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneRepository } from '../linked-phone/linked-phone-repository.js';
import { PhoneNotLinkedError } from '../linked-phone/phone-not-linked.error.js';

/**
 * La situation du pseudo du téléphone relié, que la convention calcule : ses inscriptions, et
 * l'état de chaque créneau pour lui. Servie tant que la convention n'est pas terminée.
 */
export class ReadParticipantSituation {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly phones: LinkedPhoneRepository,
    private readonly clock: Clock,
  ) {}

  /** `phoneId` : le cookie du téléphone. Sans cookie, ou relié à aucun pseudo : `PhoneNotLinkedError`. */
  async execute(phoneId: string | null): Promise<ParticipantSituationDto> {
    const convention = await this.conventions.get();
    convention.verifyStillOpenAt(this.clock.now());
    const phone = phoneId ? await this.phones.find(phoneId) : null;
    if (!phone) throw new PhoneNotLinkedError();
    return convention.computeParticipantSituation(phone.participantId);
  }
}
