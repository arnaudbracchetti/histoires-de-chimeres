// Le pic de publication (docs/load-test/plan.md § 2 et 4), en fonctions pures : sans k6 ni réseau,
// elles se vérifient par Node seul. Les instants partent du début de la phase.

/** L'Organisateur lance le tirage au début de la phase, puis le publie 30 s plus tard. */
export const PUBLISH_SECONDS = 30;
/**
 * L'instant commun du pic : la publication, et le temps que sa réponse revienne. Le pic suit
 * l'horloge, pas la réception du push (plan § 2) : un `publish` plus lent que cette marge fait
 * relire des téléphones avant la publication, et le résumé le signale.
 */
export const PEAK_SECONDS = PUBLISH_SECONDS + 2;
/** Une page ouverte relit dans les 2 s de l'instant commun. */
const OPEN_PAGE_WINDOW_SECONDS = 2;
/** Une application fermée s'ouvre dans les 60 s de l'instant commun. */
const CLOSED_APPLICATION_WINDOW_SECONDS = 60;
/** La relecture de la page ouverte. */
const PERIODIC_READ_SECONDS = 30;
/** La durée de la phase : le pic, les ouvertures étalées, puis une dernière relecture. */
export const PUBLICATION_SECONDS =
  PEAK_SECONDS + CLOSED_APPLICATION_WINDOW_SECONDS + PERIODIC_READ_SECONDS;

/**
 * L'application du téléphone est fermée au moment de la publication : un téléphone sur cinq. Les
 * téléphones de MJ (rang 9, 19…) gardent la leur ouverte.
 */
export function isApplicationClosed(phoneIndex: number): boolean {
  return phoneIndex % 5 === 0;
}

/**
 * Ce que fait le téléphone à un instant de la phase :
 * - `periodic-read` : la relecture des 30 s de la page ouverte ;
 * - `peak-read` : la relecture de la page ouverte, au pic ;
 * - `peak-opening` : l'ouverture de l'application fermée, puis une lecture.
 */
export type PublicationEvent = {
  atSeconds: number;
  kind: 'periodic-read' | 'peak-read' | 'peak-opening';
};

/**
 * Le calendrier d'un téléphone pendant la phase, dans l'ordre du temps. Page ouverte : une
 * relecture toutes les 30 s, d'un départ tiré dans les 30 premières secondes, et une relecture au
 * pic, dans ses 2 s. Application fermée : son ouverture, dans les 60 s du pic, puis une relecture
 * toutes les 30 s.
 */
export function buildPublicationTimeline(
  phoneIndex: number,
  random: () => number,
): PublicationEvent[] {
  const closed = isApplicationClosed(phoneIndex);
  const peak: PublicationEvent = closed
    ? {
        atSeconds: PEAK_SECONDS + random() * CLOSED_APPLICATION_WINDOW_SECONDS,
        kind: 'peak-opening',
      }
    : { atSeconds: PEAK_SECONDS + random() * OPEN_PAGE_WINDOW_SECONDS, kind: 'peak-read' };
  const events = [peak];
  const firstRead = closed
    ? peak.atSeconds + PERIODIC_READ_SECONDS
    : random() * PERIODIC_READ_SECONDS;
  for (let at = firstRead; at < PUBLICATION_SECONDS; at += PERIODIC_READ_SECONDS) {
    events.push({ atSeconds: at, kind: 'periodic-read' });
  }
  return events.sort((a, b) => a.atSeconds - b.atSeconds);
}
