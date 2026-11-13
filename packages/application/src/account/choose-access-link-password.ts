import type { ChooseAccessLinkPasswordBody, ConnectedAccountDto } from '@chimeres/contract';
import { ComparableName, Password, Refusal } from '@chimeres/domain';
import type { Clock } from '../clock.js';
import type { AccessLinkTokens } from './access-link-tokens.js';
import type { AccountReader } from './account-reader.js';
import type { AccountRepository } from './account-repository.js';
import type { AccountSessions } from './account-sessions.js';
import type { PasswordHasher } from './password-hasher.js';
import { findExistingUsableAccessLink } from './read-access-link.js';

/**
 * Choisir son mot de passe par un lien d'accès (ID-6, ADR 0018) : le lien ne sert qu'une fois, puis
 * la personne est connectée, par une session neuve. Le lien est vérifié avant le mot de passe : un
 * lien mort ne fait pas corriger un mot de passe pour rien. L'usage s'écrit à condition que le lien
 * n'ait ni servi ni été remplacé pendant le hachage : deux envois ne passent pas tous les deux.
 */
export class ChooseAccessLinkPassword {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly reader: AccountReader,
    private readonly tokens: AccessLinkTokens,
    private readonly hasher: PasswordHasher,
    private readonly sessions: AccountSessions,
    private readonly clock: Clock,
  ) {}

  /** L'identifiant de la session ouverte, et le compte connecté. */
  async execute(
    token: string,
    { password }: ChooseAccessLinkPasswordBody,
  ): Promise<{ sessionId: string; account: ConnectedAccountDto }> {
    const lookup = { accounts: this.accounts, reader: this.reader, tokens: this.tokens };
    const { account, nickname } = await findExistingUsableAccessLink(
      lookup,
      token,
      this.clock.now(),
    );
    const chosen = Password.createForNickname(password, ComparableName.createFromText(nickname));
    const tokenHash = account.accessLinkTokenHash!;
    account.useAccessLink(await this.hasher.hash(chosen), this.clock.now());
    if (!(await this.accounts.saveAccessLinkUse(account, tokenHash))) {
      throw new Refusal('access-link-used', {});
    }
    const connected = await this.reader.read(account.id);
    if (!connected) throw new Refusal('access-link-unknown', {});
    return { sessionId: await this.sessions.open(account.id), account: connected };
  }
}
