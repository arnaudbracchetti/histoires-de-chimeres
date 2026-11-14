import type { AccountRepository } from '../account/account-repository.js';
import { NotLoggedInError } from '../account/not-logged-in.error.js';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/**
 * Un Organisateur supprime un pseudo de participant (ID-10). Ses téléphones reliés, et son compte
 * avec ses sessions, le perdent par la cascade de la clé étrangère, dans la transaction de la
 * sauvegarde. Un Organisateur ne supprime pas son propre pseudo (ID-16). Aucune notification (NO-4).
 */
export class RemoveParticipant {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly accounts: AccountRepository,
  ) {}

  /** `actingAccountId` : le compte de l'Organisateur qui fait le geste. */
  async execute(actingAccountId: string, participantId: string): Promise<void> {
    const actingAccount = await this.accounts.findById(actingAccountId);
    if (!actingAccount) throw new NotLoggedInError();
    const accounts = await this.accounts.list();
    await changeConvention(this.conventions, (convention) =>
      convention.removeParticipant(participantId, actingAccount, accounts),
    );
  }
}
