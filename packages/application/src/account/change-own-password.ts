import type { ChangeOwnPasswordBody } from '@chimeres/contract';
import { ComparableName, Password } from '@chimeres/domain';
import type { AccountReader } from './account-reader.js';
import type { AccountRepository } from './account-repository.js';
import type { AccountSessions } from './account-sessions.js';
import { CurrentPasswordWrongError } from './current-password-wrong.error.js';
import { NotLoggedInError } from './not-logged-in.error.js';
import type { PasswordHasher } from './password-hasher.js';

/**
 * Changer son propre mot de passe, depuis sa session (ADR 0019). Le mot de passe actuel est
 * demandé : un ordinateur resté ouvert ne suffit pas à prendre le compte. Les autres sessions du
 * compte sont fermées, celle en cours reste ouverte. Après un oubli, c'est le lien d'accès qui fait
 * choisir un nouveau mot de passe (ADR 0018).
 */
export class ChangeOwnPassword {
  constructor(
    private readonly sessions: AccountSessions,
    private readonly accounts: AccountRepository,
    private readonly reader: AccountReader,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(
    sessionId: string | null,
    { currentPassword, password }: ChangeOwnPasswordBody,
  ): Promise<void> {
    if (!sessionId) throw new NotLoggedInError();
    const accountId = await this.sessions.findAccountIdAndExtend(sessionId);
    const account = accountId ? await this.accounts.findById(accountId) : null;
    const connected = account && (await this.reader.read(account.id));
    if (!account || !connected) throw new NotLoggedInError();
    if (!(await this.hasher.verify(currentPassword, account.passwordHash))) {
      throw new CurrentPasswordWrongError();
    }
    const newPassword = Password.createForNickname(
      password,
      ComparableName.createFromText(connected.nickname),
    );
    account.replacePasswordHash(await this.hasher.hash(newPassword));
    await this.accounts.save(account);
    await this.sessions.closeAllOfAccountExcept(account.id, sessionId);
  }
}
