import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/**
 * Déplacer un participant dans le tirage provisoire d'un créneau (TI-6) : vers une partie, ou vers
 * les non placés pour `null`. Aucune notification.
 */
export class MoveParticipant {
  constructor(private readonly conventions: ConventionRepository) {}

  async execute(timeSlotId: string, participantId: string, gameId: string | null): Promise<void> {
    await changeConvention(this.conventions, (convention) =>
      convention.moveParticipant(timeSlotId, participantId, gameId),
    );
  }
}
