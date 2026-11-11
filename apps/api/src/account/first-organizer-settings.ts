import type { FirstOrganizer } from '@chimeres/application';

/**
 * Le premier Organisateur de la configuration (ADR 0016) : `ORGANIZER_PSEUDO` et
 * `ORGANIZER_PASSWORD`, ou `null` sans aucune des deux (une variable vide compte comme absente).
 * Avec une seule des deux, l'API refuse de démarrer.
 */
export function readFirstOrganizerFromEnvironment(): FirstOrganizer | null {
  const nickname = process.env['ORGANIZER_PSEUDO'] ?? '';
  const password = process.env['ORGANIZER_PASSWORD'] ?? '';
  if (!nickname && !password) return null;
  if (!nickname || !password) {
    throw new Error(
      'ORGANIZER_PSEUDO et ORGANIZER_PASSWORD vont ensemble : donner les deux, ou aucune.',
    );
  }
  return { nickname, password };
}
