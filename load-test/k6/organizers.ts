// Les Organisateurs en fond, et les gestes du pic (docs/load-test/plan.md § 3 et 4).
import { Counter, Gauge } from 'k6/metrics';
import { sendAndReadResponse, sendAndVerifySuccess } from './api.ts';
import type { SignUpTrackingDto } from '../../packages/contract/dist/index.js';
import { account, draw, signUpTracking } from './endpoints.ts';
import { FAKE_PUSH_URL, readFakePushCounts } from './fake-push.ts';
import { logInOrganizer } from './preparation.ts';
import { PUBLICATION } from './publication.ts';
import { sleepUntil } from './sign-ups.ts';
import { PUBLICATION_METRICS } from './summary.ts';

export const ORGANIZERS = 'organizers';
/** Toujours 3 Organisateurs, quel que soit le nombre de téléphones. */
export const ORGANIZER_COUNT = 3;
/** L'écran de suivi se relit toutes les 30 s. */
const TRACKING_READ_MS = 30_000;

const publishRespondedAt = new Gauge(PUBLICATION_METRICS.publishRespondedAt);
const pushReadableBeforePublish = new Gauge(PUBLICATION_METRICS.pushReadableBeforePublish);
/**
 * Les relectures et les gestes interrompus par une requête en échec : la requête compte déjà dans
 * `http_req_failed`, et l'Organisateur continue.
 */
const failedEvents = new Counter('organizers_failed_events');

/** Les instants des gestes du pic, à l'heure du poste. */
export type PublicationGestures = { launchAtMs: number; publishAtMs: number };

/**
 * Un Organisateur, jusqu'à `endMs` : il se connecte, charge l'écran de suivi (son compte, puis le
 * suivi), et le relit toutes les 30 s. Celui qui porte les gestes du pic lance le tirage du créneau
 * mesuré, puis le publie, et relit le suivi après chaque geste.
 */
export function followSignUps(endMs: number, gestures: PublicationGestures | null): void {
  logInOrganizer(ORGANIZERS);
  sendAndVerifySuccess(account.read, { phase: ORGANIZERS });
  let tracking = readTracking(ORGANIZERS);
  const pending = gestures
    ? [
        { atMs: gestures.launchAtMs, run: launchDraw },
        { atMs: gestures.publishAtMs, run: publishDraw },
      ]
    : [];
  let nextReadMs = Date.now() + TRACKING_READ_MS;
  for (;;) {
    const gesture = pending[0];
    const atMs = Math.min(nextReadMs, gesture?.atMs ?? Infinity);
    if (atMs >= endMs) return;
    sleepUntil(atMs);
    try {
      if (gesture !== undefined && gesture.atMs === atMs) {
        pending.shift();
        tracking = gesture.run(tracking.timeSlots[0]!.id);
      } else {
        nextReadMs += TRACKING_READ_MS;
        tracking = readTracking(ORGANIZERS);
      }
    } catch {
      failedEvents.add(1);
    }
  }
}

/**
 * Lance le tirage du créneau mesuré, le premier de la journée, puis relit le suivi. Une partie sans
 * joueur empêcherait la publication : l'Organisateur l'annule, comme à l'écran. À 80 téléphones,
 * aucune ne l'est (plan § 5) ; à 1 téléphone, presque toutes.
 */
function launchDraw(timeSlotId: string): SignUpTrackingDto {
  sendAndVerifySuccess(draw.launch, { phase: PUBLICATION }, { timeSlotId });
  const tracking = readTracking(PUBLICATION);
  const withoutPlayers =
    tracking.timeSlots
      .find(({ id }) => id === timeSlotId)
      ?.draw?.games.filter((game) => game.withoutPlayers && !game.cancelled && game.cancellable) ??
    [];
  if (withoutPlayers.length === 0) return tracking;
  for (const { gameId } of withoutPlayers) {
    sendAndVerifySuccess(draw.cancelGame, { phase: PUBLICATION }, { gameId });
  }
  return readTracking(PUBLICATION);
}

/**
 * Publie le tirage, note l'heure de la réponse, puis relit le suivi. Juste avant, les messages déjà
 * reçus par fake-push (ceux des inscriptions) : le résumé ne compte que ceux de la publication.
 */
function publishDraw(timeSlotId: string): SignUpTrackingDto {
  if (FAKE_PUSH_URL !== null) {
    pushReadableBeforePublish.add(readFakePushCounts(FAKE_PUSH_URL, PUBLICATION).readable);
  }
  sendAndVerifySuccess(draw.publish, { phase: PUBLICATION }, { timeSlotId });
  publishRespondedAt.add(Date.now());
  return readTracking(PUBLICATION);
}

function readTracking(phase: string): SignUpTrackingDto {
  return sendAndReadResponse(signUpTracking.read, { phase });
}
