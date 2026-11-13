import { buildAccessLinkPath } from '@chimeres/contract';
import { readPublicUrl } from './public-url.js';
import { PublicUrlMissingError } from './public-url-missing.error.js';

/**
 * L'adresse publique où se construisent les liens d'accès (ADR 0018). À lire avant de créer un
 * lien : sans elle, `PublicUrlMissingError` (503), et rien n'est créé pour rien.
 */
export function readAccessLinkPublicUrl(): string {
  const publicUrl = readPublicUrl();
  if (!publicUrl) throw new PublicUrlMissingError();
  return publicUrl;
}

/** L'URL complète d'un lien d'accès, jeton compris, à remettre à la personne. */
export function buildAccessLinkUrl(publicUrl: string, token: string): string {
  return `${publicUrl}${buildAccessLinkPath(token)}`;
}
