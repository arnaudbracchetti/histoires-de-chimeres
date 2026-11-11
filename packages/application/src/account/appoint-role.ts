import type { AccountRole } from '@chimeres/contract';
import { Account } from '@chimeres/domain';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { AccountRepository } from './account-repository.js';

/**
 * Un Organisateur donne un rôle à un pseudo existant (ID-16). Donner un premier rôle crée le
 * compte, sans mot de passe ; le rôle MJ laisse au participant ses liens et ses inscriptions (ID-4).
 * Donner un rôle déjà là ne change rien.
 */
export class AppointRole {
  /** `newId` donne les identifiants du compte et du MJ : le domaine ne génère rien. */
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly accounts: AccountRepository,
    private readonly newId: () => string,
  ) {}

  async execute(participantId: string, role: AccountRole): Promise<void> {
    if (role === 'game-master') {
      await changeConvention(this.conventions, (convention) =>
        convention.appointGameMaster(this.newId(), participantId),
      );
    } else {
      const convention = await this.conventions.get();
      convention.verifyParticipantExists(participantId);
    }
    const account =
      (await this.accounts.findByParticipantId(participantId)) ??
      Account.createForParticipant(this.newId(), participantId);
    if (role === 'organizer') account.appointOrganizer();
    await this.accounts.save(account);
  }
}
