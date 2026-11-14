import type { AccountRepository } from '../account/account-repository.js';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/**
 * Un Organisateur fusionne un pseudo de participant dans un autre, participant ou MJ (ID-11), en
 * une seule sauvegarde. Les téléphones reliés du pseudo fusionné perdent leur lien par la cascade de
 * la clé étrangère : ils ne passent pas à la destination (ID-9). Une source qui a un compte est
 * refusée ; le compte de la destination ne change pas (ID-16). Aucune notification (NO-4).
 */
export class MergeParticipant {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly accounts: AccountRepository,
  ) {}

  async execute(sourceId: string, destinationId: string): Promise<void> {
    const accounts = await this.accounts.list();
    await changeConvention(this.conventions, (convention) =>
      convention.mergeParticipant(sourceId, destinationId, accounts),
    );
  }
}
