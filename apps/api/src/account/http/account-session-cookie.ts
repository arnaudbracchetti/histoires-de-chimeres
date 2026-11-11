import type { CookieOptions, Request, Response } from 'express';
import { readCookie } from '../../http/cookie.js';
import { SESSION_MAX_MS } from '../persistence/prisma-account-sessions.js';

/**
 * Le cookie de la session du back office (ADR 0019) : l'identifiant opaque de la session. Le préfixe
 * `__Host-` impose `Secure`, `Path=/` et aucun `Domain`. Distinct de `linked-phone`.
 */
export const ACCOUNT_SESSION_COOKIE = '__Host-account-session';

const OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
};

/** L'identifiant de la session, lu dans son cookie, ou `null` sans cookie. */
export function readAccountSessionId(request: Request): string | null {
  return readCookie(request, ACCOUNT_SESSION_COOKIE);
}

/** Le cookie ne vit pas plus longtemps que la session côté serveur. */
export function setAccountSessionCookie(response: Response, sessionId: string): void {
  response.cookie(ACCOUNT_SESSION_COOKIE, sessionId, { ...OPTIONS, maxAge: SESSION_MAX_MS });
}

export function clearAccountSessionCookie(response: Response): void {
  response.clearCookie(ACCOUNT_SESSION_COOKIE, OPTIONS);
}
