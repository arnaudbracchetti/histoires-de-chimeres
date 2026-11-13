import { ACCESS_LINK_PAGES } from '@chimeres/contract';

/** Les pages qu'on ouvre sans session, hors du rail : la connexion et le lien d'accès. */
const PREFIXES = ['/connexion', ACCESS_LINK_PAGES];

/** L'URL du routeur (`/lien-d-acces/…`, sans `/gestion`) est une page sans session. */
export function isPageWithoutSession(url: string): boolean {
  return PREFIXES.some((prefix) => url.startsWith(prefix));
}
