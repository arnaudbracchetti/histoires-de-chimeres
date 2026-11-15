// La phase d'inscriptions (docs/load-test/plan.md § 3, 4 et 5).
import { sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { sendAndVerifySuccess } from './api.ts';
import { readScheduleAndSituation, type Reading } from './arrival.ts';
import { signUp } from './endpoints.ts';
import {
  SIGN_UPS_SECONDS,
  buildPhoneTimeline,
  chooseGesture,
  chooseGuaranteedGameId,
  isReadOnly,
  type Gesture,
  type PhoneEvent,
} from './sign-ups-plan.ts';

export const SIGN_UPS = 'sign-ups';

/**
 * Au-delà de ce retard, un événement est abandonné : un téléphone parti en retard (arrivée plus
 * longue que prévu) ne rattrape pas son calendrier en rafale.
 */
const MAX_LATENESS_MS = 30_000;

/**
 * Les événements du plateau interrompus par une requête en échec : la requête compte déjà dans
 * `http_req_failed`, et le téléphone passe à l'événement suivant.
 */
const failedEvents = new Counter('sign_ups_failed_events');

/**
 * Le plateau d'un téléphone, à partir de `startMs` et pendant 10 minutes : il s'inscrit à sa
 * partie garantie, puis relit toutes les 30 s, à chaque changement d'écran, et après chacun de ses
 * gestes. Il ne fait jamais deux lectures en même temps : une lecture prévue pendant la précédente
 * s'y fond, comme dans le front office. Une requête en échec compte dans `http_req_failed`, et le
 * téléphone continue son calendrier.
 */
export function takePartInSignUps(phoneIndex: number, startMs: number, reading: Reading): void {
  let latest = reading;
  let guaranteedGameId: string | null = null;
  let lastReadEndMs = 0;
  for (const event of buildPhoneTimeline(SIGN_UPS_SECONDS, Math.random)) {
    const atMs = startMs + event.atSeconds * 1000;
    if (isReadOnly(event) && atMs < lastReadEndMs) continue;
    if (event.kind !== 'first-sign-up' && atMs < Date.now() - MAX_LATENESS_MS) continue;
    sleepUntil(atMs);
    try {
      const measured = computeMeasuredTimeSlot(latest);
      guaranteedGameId ??= chooseGuaranteedGameId(
        phoneIndex,
        measured.measuredGameIds,
        measured.ledGameId,
      );
      const gesture = chooseEventGesture(event, measured, guaranteedGameId);
      if (gesture !== null) sendGesture(gesture);
      latest = readScheduleAndSituation(SIGN_UPS);
    } catch {
      failedEvents.add(1);
    }
    lastReadEndMs = Date.now();
  }
}

/** Le geste de l'événement : l'inscription garantie, un geste au hasard, ou aucun pour une lecture. */
function chooseEventGesture(
  event: PhoneEvent,
  measured: MeasuredTimeSlot,
  guaranteedGameId: string,
): Gesture | null {
  if (event.kind === 'first-sign-up') return { kind: 'signUp', gameId: guaranteedGameId };
  if (event.kind !== 'gesture') return null;
  return chooseGesture(Math.random, { ...measured, guaranteedGameId });
}

/** Dort jusqu'à l'instant donné, s'il n'est pas déjà passé. */
export function sleepUntil(atMs: number): void {
  const waitMs = atMs - Date.now();
  if (waitMs > 0) sleep(waitMs / 1000);
}

/** Le créneau mesuré vu du téléphone, tel que `chooseGesture` le lit. */
type MeasuredTimeSlot = {
  measuredGameIds: string[];
  ledGameId: string | null;
  signedUpGameIds: string[];
};

/**
 * Le créneau mesuré, le premier de la journée (la préparation le place une heure après le
 * lancement), vu du téléphone : ses parties dans l'ordre du programme, la partie qu'y mène son MJ,
 * et ses inscriptions, de secours comprises.
 */
function computeMeasuredTimeSlot({ schedule, situation }: Reading): MeasuredTimeSlot {
  const timeSlotId = schedule.timeSlots[0]!.id;
  const gameIds = schedule.games
    .filter((game) => game.timeSlotIds[0] === timeSlotId)
    .map(({ id }) => id);
  const measured = new Set(gameIds);
  return {
    measuredGameIds: gameIds,
    ledGameId:
      situation.timeSlots.find((slot) => slot.timeSlotId === timeSlotId)?.ledGameId ?? null,
    signedUpGameIds: [...situation.signedUpGameIds, ...situation.backupGameIds].filter((id) =>
      measured.has(id),
    ),
  };
}

function sendGesture({ kind, gameId }: Gesture): void {
  sendAndVerifySuccess(signUp[kind], { phase: SIGN_UPS }, { gameId });
}
