import type { AccountRole, AddParticipantBody } from '@chimeres/contract';
import { Account } from '@chimeres/domain';
import type { AccessLinkTokens, IssuedAccessLink } from '../account/access-link-tokens.js';
import type { AccountRepository } from '../account/account-repository.js';
import { toLocalMomentDto } from '../account/local-moment-dto.js';
import type { Clock } from '../clock.js';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Le pseudo créé, son MJ éventuel et le lien d'accès de son compte, rendu une seule fois. */
export type AddedParticipant = {
  participantId: string;
  gameMasterId: string | null;
  accessLink: IssuedAccessLink | null;
};

/**
 * L'assistant « Créer un pseudo », seule façon de créer un pseudo, et donc un MJ. Sans rôle, un
 * simple participant, pour une personne sans téléphone (ID-12). Avec un rôle, le pseudo, son MJ
 * éventuel (ADR 0012) et son compte, avec un lien d'accès (ID-16, ADR 0018). Le pseudo suit les
 * règles de sa création (ID-4, ID-7) : un pseudo pris refuse tout, avant le compte.
 */
export class AddParticipant {
  /** `newId` donne les identifiants du participant, du MJ et du compte : le domaine ne génère rien. */
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly accounts: AccountRepository,
    private readonly tokens: AccessLinkTokens,
    private readonly clock: Clock,
    private readonly newId: () => string,
  ) {}

  async execute({ nickname, roles = [] }: AddParticipantBody): Promise<AddedParticipant> {
    const participantId = this.newId();
    const gameMasterId = roles.includes('game-master') ? this.newId() : null;
    await changeConvention(this.conventions, (convention) => {
      convention.addParticipant(participantId, nickname);
      if (gameMasterId) convention.appointGameMaster(gameMasterId, participantId);
    });
    const accessLink = roles.length ? await this.createAccount(participantId, roles) : null;
    return { participantId, gameMasterId, accessLink };
  }

  private async createAccount(
    participantId: string,
    roles: AccountRole[],
  ): Promise<IssuedAccessLink> {
    const account = Account.createForParticipant(this.newId(), participantId);
    if (roles.includes('organizer')) account.appointOrganizer();
    const { token, tokenHash } = this.tokens.generate();
    const expiresAt = account.createAccessLink(tokenHash, this.clock.now());
    await this.accounts.save(account);
    return { token, expiresAt: toLocalMomentDto(expiresAt) };
  }
}
