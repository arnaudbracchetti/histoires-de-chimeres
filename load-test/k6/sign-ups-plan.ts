// Le plateau des inscriptions (docs/load-test/plan.md § 4 et 5), en fonctions pures : sans k6 ni
// réseau, elles se vérifient par Node seul.

/** La durée du plateau des inscriptions. */
export const SIGN_UPS_SECONDS = 600;
/** La relecture de la page ouverte. */
const PERIODIC_READ_SECONDS = 30;
/** Un changement d'écran toutes les 60 s environ : entre 30 et 90 s. */
const SCREEN_CHANGE_MIN_SECONDS = 30;
const SCREEN_CHANGE_SPREAD_SECONDS = 60;
/** Un geste toutes les 2 min en moyenne, au hasard (intervalles exponentiels). */
const GESTURE_MEAN_SECONDS = 120;

/**
 * Ce que fait le téléphone à un instant du plateau. Chaque événement finit par une lecture :
 * - `first-sign-up` : l'inscription à sa partie garantie ;
 * - `periodic-read` : la relecture des 30 s ;
 * - `screen-read` : la lecture d'un changement d'écran ;
 * - `gesture` : un `signUp` ou un `withdraw`.
 */
export type PhoneEvent = {
  atSeconds: number;
  kind: 'first-sign-up' | 'periodic-read' | 'screen-read' | 'gesture';
};

/** L'événement est une lecture seule, sans geste. */
export function isReadOnly(event: PhoneEvent): boolean {
  return event.kind === 'periodic-read' || event.kind === 'screen-read';
}

/**
 * Le calendrier d'un téléphone sur le plateau : son inscription garantie à un instant tiré dans les
 * 30 premières secondes (le départ décalé), puis une relecture toutes les 30 s à partir de lui, des
 * changements d'écran toutes les 60 s environ et des gestes toutes les 2 min en moyenne. Dans
 * l'ordre du temps.
 */
export function buildPhoneTimeline(durationSeconds: number, random: () => number): PhoneEvent[] {
  const start = random() * PERIODIC_READ_SECONDS;
  const events: PhoneEvent[] = [{ atSeconds: start, kind: 'first-sign-up' }];
  for (let at = start + PERIODIC_READ_SECONDS; at < durationSeconds; at += PERIODIC_READ_SECONDS) {
    events.push({ atSeconds: at, kind: 'periodic-read' });
  }
  const nextScreenChange = () =>
    SCREEN_CHANGE_MIN_SECONDS + random() * SCREEN_CHANGE_SPREAD_SECONDS;
  for (let at = start + nextScreenChange(); at < durationSeconds; at += nextScreenChange()) {
    events.push({ atSeconds: at, kind: 'screen-read' });
  }
  const nextGesture = () => -Math.log(1 - random()) * GESTURE_MEAN_SECONDS;
  for (let at = start + nextGesture(); at < durationSeconds; at += nextGesture()) {
    events.push({ atSeconds: at, kind: 'gesture' });
  }
  return events.sort((a, b) => a.atSeconds - b.atSeconds);
}

/**
 * La partie garantie du téléphone `n` : la partie `n mod 6` du créneau mesuré, dans l'ordre du
 * programme, pour qu'aucune ne reste vide au tirage. Un MJ ne s'inscrit pas à sa propre partie : il
 * prend la suivante.
 */
export function chooseGuaranteedGameId(
  phoneIndex: number,
  measuredGameIds: string[],
  ledGameId: string | null,
): string {
  const rank = phoneIndex % measuredGameIds.length;
  const gameId = measuredGameIds[rank]!;
  return gameId === ledGameId ? measuredGameIds[(rank + 1) % measuredGameIds.length]! : gameId;
}

/** Un geste des inscriptions, sur une partie du créneau mesuré. */
export type Gesture = { kind: 'signUp' | 'withdraw'; gameId: string };

/** Les gestes : 70 % d'inscriptions, 30 % de désinscriptions. */
const SIGN_UP_SHARE = 0.7;

/**
 * Un geste au hasard sur le créneau mesuré : 7 fois sur 10, l'inscription à une partie où le
 * téléphone n'est pas encore, hors celle de son MJ ; sinon, la désinscription d'une de ses parties,
 * jamais de sa partie garantie. Quand l'un des deux n'a plus de partie, il fait l'autre.
 */
export function chooseGesture(
  random: () => number,
  phone: {
    measuredGameIds: string[];
    signedUpGameIds: string[];
    guaranteedGameId: string;
    ledGameId: string | null;
  },
): Gesture {
  const signedUp = new Set(phone.signedUpGameIds);
  const toSignUp = phone.measuredGameIds.filter(
    (gameId) => !signedUp.has(gameId) && gameId !== phone.ledGameId,
  );
  const toWithdraw = phone.measuredGameIds.filter(
    (gameId) => signedUp.has(gameId) && gameId !== phone.guaranteedGameId,
  );
  const wantsSignUp = random() < SIGN_UP_SHARE;
  const kind =
    toWithdraw.length === 0 || (wantsSignUp && toSignUp.length > 0) ? 'signUp' : 'withdraw';
  const candidates = kind === 'signUp' ? toSignUp : toWithdraw;
  return { kind, gameId: candidates[Math.floor(random() * candidates.length)]! };
}
