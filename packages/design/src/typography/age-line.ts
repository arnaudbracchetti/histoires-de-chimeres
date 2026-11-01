import { formatDayAndMonth } from './date.js';
import { fr } from './french.js';
import { formatTimeOfDay } from './time.js';

/** Au-delà, la ligne d'âge dit de quand datent les chiffres (§6, Fraîcheur). */
const STALE_AFTER_MS = 2 * 60_000;

/**
 * La ligne d'âge des deux fronts : « Pas de connexion · à jour à 14 h 05 », ou « … le 26 octobre
 * à 18 h 05 » un autre jour, quand la dernière lecture réussie, `readAt`, a plus de 2 minutes ;
 * `null` sinon.
 */
export function formatAgeLine(readAt: Date, now: Date): string | null {
  if (now.getTime() - readAt.getTime() <= STALE_AFTER_MS) return null;
  const time = formatTimeOfDay(readAt);
  return readAt.toDateString() === now.toDateString()
    ? fr`Pas de connexion · à jour à ${time}`
    : fr`Pas de connexion · à jour le ${formatDayAndMonth(readAt)} à ${time}`;
}
