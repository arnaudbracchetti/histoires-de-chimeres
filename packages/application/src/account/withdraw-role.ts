import type { AccountRole } from '@chimeres/contract';
import type { Convention } from '@chimeres/domain';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';
import type { AccountRepository } from './account-repository.js';
import { NotLoggedInError } from './not-logged-in.error.js';

/**
 * Un Organisateur retire un rôle à un pseudo (ID-16). Le rôle MJ est refusé tant que le MJ a un
 * scénario ; sinon, ses disponibilités partent et son participant reste (PR-12). Le rôle
 * d'Organisateur, il ne se le retire pas lui-même. Sans plus aucun rôle, le compte est supprimé,
 * avec son mot de passe et ses sessions ; le pseudo reste un participant. Ailleurs, le changement
 * vaut dès la requête suivante, sans fermer de session. Retirer un rôle absent ne change rien.
 */
export class WithdrawRole {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly accounts: AccountRepository,
  ) {}

  /** `actingAccountId` : le compte de l'Organisateur qui fait le geste. */
  async execute(actingAccountId: string, participantId: string, role: AccountRole): Promise<void> {
    const actingAccount = await this.accounts.findById(actingAccountId);
    if (!actingAccount) throw new NotLoggedInError();
    const convention =
      role === 'game-master'
        ? await this.withdrawGameMasterRole(participantId)
        : await this.conventions.get();
    convention.verifyParticipantExists(participantId);
    const account = await this.accounts.findByParticipantId(participantId);
    if (!account) return;
    if (role === 'organizer') account.withdrawOrganizerRole(actingAccount);
    if (account.isWithoutRole(convention)) await this.accounts.remove(account);
    else await this.accounts.save(account);
  }

  /** La convention sauvegardée sans le rôle MJ du participant. */
  private async withdrawGameMasterRole(participantId: string): Promise<Convention> {
    const catalogue = await this.scenarios.catalogue();
    return changeConvention(this.conventions, (convention) => {
      convention.withdrawGameMasterRole(participantId, catalogue);
      return convention;
    });
  }
}
