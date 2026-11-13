import type { LocalMomentDto } from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import type { Clock } from '../clock.js';
import type { AccessLinkTokens } from './access-link-tokens.js';
import type { AccountRepository } from './account-repository.js';
import type { AccountSessions } from './account-sessions.js';
import { toLocalMomentDto } from './local-moment-dto.js';

/**
 * Un Organisateur crée un lien d'accès pour le compte d'un pseudo (ID-6, ADR 0018) : il remplace le
 * précédent et remet le compte à zéro, mot de passe effacé et toutes les sessions fermées.
 */
export class CreateAccessLink {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: AccountSessions,
    private readonly tokens: AccessLinkTokens,
    private readonly clock: Clock,
  ) {}

  /** Le jeton, rendu une seule fois, et la fin de validité du lien. */
  async execute(participantId: string): Promise<{ token: string; expiresAt: LocalMomentDto }> {
    const account = await this.accounts.findByParticipantId(participantId);
    if (!account) throw new Refusal('account-not-found', {});
    const { token, tokenHash } = this.tokens.generate();
    const expiresAt = account.createAccessLink(tokenHash, this.clock.now());
    await this.accounts.save(account);
    await this.sessions.closeAllOfAccount(account.id);
    return { token, expiresAt: toLocalMomentDto(expiresAt) };
  }
}
