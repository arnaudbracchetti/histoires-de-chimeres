import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/**
 * Un Organisateur fusionne un pseudo de participant dans un autre, participant ou MJ (ID-11), en
 * une seule sauvegarde. Les téléphones reliés du pseudo fusionné perdent leur lien par la cascade de
 * la clé étrangère : ils ne passent pas à la destination (ID-9). Aucune notification (NO-4).
 */
export class MergeParticipant {
  constructor(private readonly repository: ConventionRepository) {}

  execute(sourceId: string, destinationId: string): Promise<void> {
    return changeConvention(this.repository, (convention) =>
      convention.mergeParticipant(sourceId, destinationId),
    );
  }
}
