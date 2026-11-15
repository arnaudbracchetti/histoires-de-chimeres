// Le pic de publication, côté téléphones (docs/load-test/plan.md § 3 et 4).
import { Counter, Trend } from 'k6/metrics';
import { sendAndVerifySuccess } from './api.ts';
import { openApplication, readScheduleAndSituation, type Reading } from './arrival.ts';
import type { PushSubscriptionBody } from '../../packages/contract/dist/index.js';
import { pushSubscription } from './endpoints.ts';
import { buildPublicationTimeline } from './publication-plan.ts';
import { sleepUntil } from './sign-ups.ts';
import { PUBLICATION_METRICS } from './summary.ts';

export const PUBLICATION = 'publication';

/** Une relecture prévue plus de 30 s en retard est abandonnée, comme sur le plateau. */
const MAX_LATENESS_MS = 30_000;

const peakReadStartedAt = new Trend(PUBLICATION_METRICS.peakReadStartedAt);
const peakReadEndedAt = new Trend(PUBLICATION_METRICS.peakReadEndedAt);
const pushExpected = new Counter(PUBLICATION_METRICS.pushExpected);
/** Les événements interrompus par une requête en échec, déjà comptée dans `http_req_failed`. */
const failedEvents = new Counter('publication_failed_events');

/**
 * La phase d'un téléphone, à partir de `startMs` : l'Organisateur lance le tirage, puis le publie.
 * Page ouverte, le téléphone relit toutes les 30 s, et au pic. Application fermée, il l'ouvre au
 * pic, range de nouveau son abonnement comme le front office, et lit. Il ne fait jamais deux
 * lectures en même temps. À la fin, un téléphone abonné et présent dans le tirage publié compte la
 * notification qu'il attend.
 */
export function takePartInPublication(
  phoneIndex: number,
  startMs: number,
  reading: Reading,
  subscription: PushSubscriptionBody | null,
): void {
  let latest = reading;
  let lastReadEndMs = 0;
  for (const event of buildPublicationTimeline(phoneIndex, Math.random)) {
    const atMs = startMs + event.atSeconds * 1000;
    if (event.kind === 'periodic-read' && atMs < lastReadEndMs) continue;
    if (event.kind === 'periodic-read' && atMs < Date.now() - MAX_LATENESS_MS) continue;
    sleepUntil(atMs);
    try {
      if (event.kind === 'peak-opening') {
        openApplication(PUBLICATION);
        if (subscription !== null) {
          sendAndVerifySuccess(pushSubscription.save, { phase: PUBLICATION, body: subscription });
        }
      }
      const startedAtMs = Date.now();
      latest = readScheduleAndSituation(PUBLICATION);
      if (event.kind === 'peak-read') {
        peakReadStartedAt.add(startedAtMs);
        peakReadEndedAt.add(Date.now());
      }
    } catch {
      failedEvents.add(1);
    }
    lastReadEndMs = Date.now();
  }
  if (subscription !== null && isInPublishedDraw(latest)) pushExpected.add(1);
}

/**
 * Le pseudo a un résultat dans le tirage publié du créneau mesuré, le premier de la journée : sa
 * partie, pas de place, ou ses joueurs de MJ. La publication lui envoie une notification, une seule.
 */
function isInPublishedDraw({ schedule, situation }: Reading): boolean {
  const timeSlotId = schedule.timeSlots[0]!.id;
  const slot = situation.timeSlots.find((candidate) => candidate.timeSlotId === timeSlotId);
  return slot?.drawResult != null;
}
