import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/**
 * Un Organisateur retire du tirage d'un créneau un pseudo qui y est sans partie, à sa place
 * (ID-12, IN-6). Sans cet état, rien n'est sauvegardé. Aucune notification (NO-4).
 */
export class WithdrawParticipantFromDraw {
  constructor(private readonly conventions: ConventionRepository) {}

  async execute(participantId: string, timeSlotId: string): Promise<void> {
    await changeConvention(
      this.conventions,
      (convention) => convention.withdrawFromDraw(participantId, timeSlotId),
      (changed) => changed,
    );
  }
}
