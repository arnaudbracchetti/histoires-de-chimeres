import type { AccountRepository } from '../account/account-repository.js';
import { NotLoggedInError } from '../account/not-logged-in.error.js';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/**
 * Supprimer un MJ qui n'a aucun scénario (PR-12), et avec lui son pseudo : son compte et ses
 * sessions partent par la cascade de la clé étrangère. Un Organisateur ne supprime pas son propre
 * pseudo (ID-16).
 */
export class RemoveGameMaster {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly accounts: AccountRepository,
  ) {}

  /**
   * `actingAccountId` : le compte de l'Organisateur qui fait le geste. Le catalogue et les comptes
   * sont lus avant la convention. Un scénario proposé entre les deux bute sur la clé étrangère du
   * scénario vers son MJ, qui sert de filet.
   */
  async execute(actingAccountId: string, gameMasterId: string): Promise<void> {
    const actingAccount = await this.accounts.findById(actingAccountId);
    if (!actingAccount) throw new NotLoggedInError();
    const accounts = await this.accounts.list();
    const catalogue = await this.scenarios.catalogue();
    await changeConvention(this.conventions, (convention) =>
      convention.removeGameMaster(gameMasterId, catalogue, actingAccount, accounts),
    );
  }
}
