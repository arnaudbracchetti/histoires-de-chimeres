import type { ConnectedAccountDto, LogInBody } from '@chimeres/contract';
import type { AccountReader } from './account-reader.js';
import type { AccountRepository } from './account-repository.js';
import type { AccountSessions } from './account-sessions.js';
import type { PasswordHasher } from './password-hasher.js';
import { WrongCredentialsError } from './wrong-credentials.error.js';

/**
 * Se connecter au back office par le pseudo et le mot de passe (ADR 0015, 0018). Pseudo inconnu,
 * compte sans mot de passe et mauvais mot de passe donnent la même erreur, après le même calcul.
 * Chaque connexion ouvre une session neuve (ADR 0019).
 */
export class LogIn {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: AccountSessions,
    private readonly reader: AccountReader,
  ) {}

  /** L'identifiant de la session ouverte, et le compte connecté. */
  async execute({
    nickname,
    password,
  }: LogInBody): Promise<{ sessionId: string; account: ConnectedAccountDto }> {
    const account = await this.accounts.findByNickname(nickname);
    const verified = await this.hasher.verify(password, account?.passwordHash ?? null);
    if (!account || !verified) throw new WrongCredentialsError();
    const connected = await this.reader.read(account.id);
    if (!connected) throw new WrongCredentialsError();
    return { sessionId: await this.sessions.open(account.id), account: connected };
  }
}
