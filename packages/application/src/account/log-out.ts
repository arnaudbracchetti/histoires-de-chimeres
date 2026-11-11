import type { AccountSessions } from './account-sessions.js';

/** Se déconnecter : la session est supprimée en base, son cookie ne sert plus (ADR 0019). */
export class LogOut {
  constructor(private readonly sessions: AccountSessions) {}

  /** Sans session, rien à faire. */
  async execute(sessionId: string | null): Promise<void> {
    if (sessionId) await this.sessions.close(sessionId);
  }
}
