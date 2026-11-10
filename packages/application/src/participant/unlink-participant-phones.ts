import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneRepository } from '../linked-phone/linked-phone-repository.js';

/**
 * Un Organisateur coupe tous les liens d'un pseudo, de participant ou de MJ (ID-5, ID-8), en un
 * geste et sans verrou. Les téléphones vivent hors de la convention (ADR 0009) : elle ne change pas,
 * et personne n'est notifié (NO-4).
 */
export class UnlinkParticipantPhones {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly phones: LinkedPhoneRepository,
  ) {}

  async execute(participantId: string): Promise<void> {
    (await this.conventions.get()).verifyParticipantExists(participantId);
    await this.phones.unlinkAllPhonesOfParticipant(participantId);
  }
}
