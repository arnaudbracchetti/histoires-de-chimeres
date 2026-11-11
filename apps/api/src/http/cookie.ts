import type { Request } from 'express';

/** La valeur du cookie `name` de la requête, ou `null` sans ce cookie ou vide. */
export function readCookie(request: Request, name: string): string | null {
  for (const pair of request.headers.cookie?.split(';') ?? []) {
    const [key, ...value] = pair.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('=')) || null;
  }
  return null;
}
