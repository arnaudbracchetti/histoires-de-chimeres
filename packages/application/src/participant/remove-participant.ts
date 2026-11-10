import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/**
 * Un Organisateur supprime un pseudo de participant (ID-10). Ses téléphones reliés le perdent par
 * la cascade de la clé étrangère, dans la transaction de la sauvegarde. Aucune notification (NO-4).
 */
export class RemoveParticipant {
  constructor(private readonly repository: ConventionRepository) {}

  execute(participantId: string): Promise<void> {
    return changeConvention(this.repository, (convention) =>
      convention.removeParticipant(participantId),
    );
  }
}
