import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/**
 * Un Organisateur désinscrit un pseudo d'une partie, à sa place (ID-12, IN-2). Retirer une
 * inscription absente ne sauvegarde rien. Aucune notification (NO-4).
 */
export class WithdrawParticipantFromGame {
  constructor(private readonly conventions: ConventionRepository) {}

  async execute(participantId: string, gameId: string): Promise<void> {
    await changeConvention(
      this.conventions,
      (convention) => convention.withdrawFromGame(participantId, gameId),
      (changed) => changed,
    );
  }
}
