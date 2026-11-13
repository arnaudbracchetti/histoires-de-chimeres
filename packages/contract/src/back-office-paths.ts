/** La racine du back office, servi par l'API à côté du front office. */
export const BACK_OFFICE_ROOT = '/gestion';

const ACCESS_LINK_SEGMENT = 'lien-d-acces';

/** Les chemins du back office, sans `/` du début, que lit son routeur. */
export const backOfficePaths = {
  /** La page « Choisis ton mot de passe » d'un lien d'accès (ADR 0018). */
  accessLink: `${ACCESS_LINK_SEGMENT}/:token`,
} as const;

/** Le début du chemin de toute page de lien d'accès, depuis la racine du back office. */
export const ACCESS_LINK_PAGES = `/${ACCESS_LINK_SEGMENT}/`;

/** Le chemin d'un lien d'accès depuis la racine du site : `/gestion/lien-d-acces/<jeton>`. */
export function buildAccessLinkPath(token: string): string {
  return `${BACK_OFFICE_ROOT}/${backOfficePaths.accessLink.replace(':token', encodeURIComponent(token))}`;
}
