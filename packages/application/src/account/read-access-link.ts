import type { AccessLinkDto } from '@chimeres/contract';
import { Refusal, type Account, type LocalMoment } from '@chimeres/domain';
import type { Clock } from '../clock.js';
import type { AccessLinkTokens } from './access-link-tokens.js';
import type { AccountReader } from './account-reader.js';
import type { AccountRepository } from './account-repository.js';

/**
 * Lire un lien d'accès avant de choisir son mot de passe (ADR 0018) : le pseudo du compte, sans
 * rien changer. Un lien inconnu, utilisé ou expiré est refusé, comme à son usage.
 */
export class ReadAccessLink {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly reader: AccountReader,
    private readonly tokens: AccessLinkTokens,
    private readonly clock: Clock,
  ) {}

  async execute(token: string): Promise<AccessLinkDto> {
    const { nickname } = await findExistingUsableAccessLink(
      { accounts: this.accounts, reader: this.reader, tokens: this.tokens },
      token,
      this.clock.now(),
    );
    return { nickname };
  }
}

/** Les ports qui retrouvent le compte d'un lien d'accès. */
export type AccessLinkLookup = {
  accounts: AccountRepository;
  reader: AccountReader;
  tokens: AccessLinkTokens;
};

/**
 * Le compte dont le lien d'accès a ce jeton, et son pseudo, si le lien peut encore servir à `now`.
 * Sinon, le refus : `access-link-unknown`, `access-link-used` ou `access-link-expired`.
 */
export async function findExistingUsableAccessLink(
  { accounts, reader, tokens }: AccessLinkLookup,
  token: string,
  now: LocalMoment,
): Promise<{ account: Account; nickname: string }> {
  const account = await accounts.findByAccessLinkTokenHash(tokens.hash(token));
  if (!account) throw new Refusal('access-link-unknown', {});
  account.verifyAccessLinkUsable(now);
  const connected = await reader.read(account.id);
  if (!connected) throw new Refusal('access-link-unknown', {});
  return { account, nickname: connected.nickname };
}
