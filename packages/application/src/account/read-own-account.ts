import type { ConnectedAccountDto } from '@chimeres/contract';
import type { AccountReader } from './account-reader.js';
import type { AccountSessions } from './account-sessions.js';
import { NotLoggedInError } from './not-logged-in.error.js';

/** Lire son propre compte, par sa session, qu'il prolonge (ADR 0019). */
export class ReadOwnAccount {
  constructor(
    private readonly sessions: AccountSessions,
    private readonly reader: AccountReader,
  ) {}

  async execute(sessionId: string | null): Promise<ConnectedAccountDto> {
    const accountId = sessionId && (await this.sessions.findAccountIdAndExtend(sessionId));
    const account = accountId ? await this.reader.read(accountId) : null;
    if (!account) throw new NotLoggedInError();
    return account;
  }
}
