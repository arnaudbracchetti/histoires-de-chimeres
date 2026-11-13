import type { EndpointAccess } from './endpoint.js';

/** Ce qu'un niveau d'accès lit d'un compte du back office : son rôle d'Organisateur et son MJ. */
export type AccessHolder = { organizer: boolean; gameMasterId: string | null };

/**
 * Le compte (ou personne, `null`) peut-il appeler un endpoint de ce niveau (ADR 0017) ? Seule
 * source de la règle : le garde de l'API l'applique, les fronts la lisent pour masquer un geste
 * interdit. `ownGameMaster` compare le `:gameMasterId` du chemin au MJ du compte ; un Organisateur
 * passe partout (PR-13).
 */
export function isAccessAllowed(
  access: EndpointAccess,
  account: AccessHolder | null,
  pathGameMasterId?: string,
): boolean {
  if (access === 'public' || access === 'linkedPhone') return true;
  if (!account) return false;
  if (account.organizer) return true;
  if (account.gameMasterId === null) return false;
  if (access === 'gameMaster') return true;
  return access === 'ownGameMaster' && pathGameMasterId === account.gameMasterId;
}
