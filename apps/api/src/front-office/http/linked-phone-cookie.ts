import type { CookieOptions, Request, Response } from 'express';
import { API_PREFIX } from '@chimeres/contract';

/** Le cookie de session du téléphone relié (ADR 0009) : l'identifiant opaque du téléphone. */
const NAME = 'linked-phone';

const OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  // Seule l'API le lit.
  path: `/${API_PREFIX}`,
};

/** Trente jours : le code de présence ouvre l'application bien avant le jour J. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** L'identifiant du téléphone, lu dans son cookie, ou `null` sans cookie. */
export function linkedPhoneIdOf(request: Request): string | null {
  for (const pair of request.headers.cookie?.split(';') ?? []) {
    const [name, ...value] = pair.trim().split('=');
    if (name === NAME) return decodeURIComponent(value.join('=')) || null;
  }
  return null;
}

export function setLinkedPhoneCookie(response: Response, phoneId: string): void {
  response.cookie(NAME, phoneId, { ...OPTIONS, maxAge: MAX_AGE_MS });
}

export function clearLinkedPhoneCookie(response: Response): void {
  response.clearCookie(NAME, OPTIONS);
}
