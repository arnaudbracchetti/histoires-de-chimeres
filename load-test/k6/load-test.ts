// Test de charge de l'API (docs/load-test/plan.md). Lancement : voir load-test/README.md.
import exec from 'k6/execution';
import { sleep } from 'k6';
import type { Options } from 'k6/options';
import {
  ARRIVAL,
  ARRIVAL_SECONDS,
  arrive,
  linkPhone,
  getPhoneIndex,
  readScheduleAndSituation,
  type Reading,
} from './arrival.ts';
import { frontOffice, linkedPhone, pushSubscription, signUp } from './endpoints.ts';
import { GUARD, readGuardUrls, watchNeighbours } from './guard.ts';
import { prepareConvention, type PreparedConvention } from './preparation.ts';
import { SIGN_UPS, sleepUntil, takePartInSignUps } from './sign-ups.ts';
import { SIGN_UPS_SECONDS } from './sign-ups-plan.ts';

/** Le nombre de téléphones : 1 pour la mesure de référence, puis 80, 160 et 240. */
const PHONE_COUNT = Number(__ENV.PHONES ?? '1');
/**
 * La phase à lancer seule, pour la mise au point : `arrival` ou `sign-ups`. Sans `PHASE`, toutes,
 * à la suite. Seuls, les téléphones des inscriptions se relient d'abord vite, sans s'abonner au push
 * (tag `quick-link`).
 */
const PHASE = __ENV.PHASE ?? '';
if (!['', ARRIVAL, SIGN_UPS].includes(PHASE)) {
  throw new Error(`PHASE inconnue : ${PHASE}. Valeurs : ${ARRIVAL}, ${SIGN_UPS}, ou rien.`);
}
/** La montée, puis la saisie la plus lente (15 s) et une marge. */
const ARRIVAL_MAX_SECONDS = ARRIVAL_SECONDS + 60;
/** Inscriptions seules : les téléphones se relient en 20 s, et le plateau part 10 s après. */
const QUICK_LINK = 'quick-link';
const QUICK_LINK_SECONDS = 20;
const QUICK_LINK_MARGIN_SECONDS = 10;
const SIGN_UPS_START_SECONDS =
  PHASE === SIGN_UPS ? QUICK_LINK_SECONDS + QUICK_LINK_MARGIN_SECONDS : ARRIVAL_MAX_SECONDS;
/** Une marge pour la dernière lecture du plateau. */
const LAST_READ_MARGIN_SECONDS = 30;
const SIGN_UPS_END_SECONDS = SIGN_UPS_START_SECONDS + SIGN_UPS_SECONDS + LAST_READ_MARGIN_SECONDS;
/** La durée de toutes les phases : le garde-fou surveille jusqu'au bout. */
const TEST_SECONDS = PHASE === ARRIVAL ? ARRIVAL_MAX_SECONDS : SIGN_UPS_END_SECONDS;
const GUARD_URLS = readGuardUrls();
/** Le scénario k6 des téléphones : chacun garde son cookie d'une phase à l'autre. */
const PHONES = 'phones';

/** Les endpoints de la phase d'arrivée : le résumé donne la durée de chacun. */
const ARRIVAL_ENDPOINTS = [
  frontOffice.read,
  frontOffice.verifyPresenceCode,
  frontOffice.readSchedule,
  frontOffice.readSituation,
  linkedPhone.read,
  linkedPhone.link,
  pushSubscription.readPublicKey,
  pushSubscription.save,
];

/** Les endpoints de la phase d'inscriptions. */
const SIGN_UPS_ENDPOINTS = [
  frontOffice.readSchedule,
  frontOffice.readSituation,
  signUp.signUp,
  signUp.withdraw,
];

export const options: Options = {
  // Un téléphone garde son cookie `linked-phone` d'une itération à l'autre.
  noCookiesReset: true,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  // La préparation fait environ 150 écritures, une à une.
  setupTimeout: '5m',
  scenarios: {
    // Un seul scénario pour toute la vie du téléphone : un utilisateur virtuel k6 garde sa boîte à
    // cookies, donc son lien, d'une phase à l'autre. Chaque requête porte le tag de sa phase.
    [PHONES]: {
      executor: 'per-vu-iterations',
      exec: 'runPhone',
      vus: PHONE_COUNT,
      iterations: 1,
      maxDuration: `${TEST_SECONDS}s`,
    },
    ...(GUARD_URLS.length > 0 && {
      [GUARD]: {
        executor: 'constant-vus',
        exec: 'runGuard',
        vus: 1,
        duration: `${TEST_SECONDS}s`,
      },
    }),
  },
  // Sans seuil, le résumé ne montre pas un tag à part : `max>=0` ne fait qu'ouvrir ces lignes.
  // Les vrais seuils se fixent à la fin de la première campagne (plan § 9).
  thresholds: {
    ...(PHASE !== SIGN_UPS && buildSummaryLines(ARRIVAL, ARRIVAL_ENDPOINTS)),
    ...(PHASE !== ARRIVAL && {
      ...buildSummaryLines(SIGN_UPS, SIGN_UPS_ENDPOINTS),
      // Le débit du plateau : ce nombre divisé par sa durée (600 s), attendu entre 8 et 10 GET/s
      // à 80 téléphones.
      [`http_reqs{scenario:${SIGN_UPS},method:GET}`]: ['count>=0'],
    }),
    // Arrêt d'urgence : plus de 20 % d'erreurs, refus attendus exclus. k6 calcule ce taux depuis le
    // début du test, pas sur une fenêtre glissante : il n'est jugé qu'après 30 s.
    http_req_failed: [{ threshold: 'rate<0.2', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

export function setup(): PreparedConvention {
  return prepareConvention();
}

/** La vie d'un téléphone : son arrivée, puis le plateau des inscriptions. */
export function runPhone(data: PreparedConvention): void {
  const reading = PHASE === SIGN_UPS ? linkQuickly(data) : arrive(data, PHONE_COUNT);
  if (PHASE === ARRIVAL) return;
  const signUpsStartMs = exec.scenario.startTime + SIGN_UPS_START_SECONDS * 1000;
  sleepUntil(signUpsStartMs);
  takePartInSignUps(getPhoneIndex(), signUpsStartMs, reading);
}

/** Inscriptions seules : le téléphone se relie sans attendre ni s'abonner au push, puis lit. */
function linkQuickly(data: PreparedConvention): Reading {
  const phoneIndex = getPhoneIndex();
  sleep((phoneIndex * QUICK_LINK_SECONDS) / PHONE_COUNT);
  linkPhone(QUICK_LINK, data, phoneIndex);
  return readScheduleAndSituation(QUICK_LINK);
}

/**
 * Ouvre, pour chaque endpoint de la phase, une ligne de durée et une ligne de taux d'erreur dans le
 * résumé (voir les `thresholds`).
 */
function buildSummaryLines(phase: string, endpoints: { name: string }[]): Record<string, string[]> {
  return Object.fromEntries(
    endpoints.flatMap(({ name }) => [
      [`http_req_duration{endpoint:${name},scenario:${phase}}`, ['max>=0']],
      [`http_req_failed{endpoint:${name},scenario:${phase}}`, ['rate>=0']],
    ]),
  );
}

export function runGuard(): void {
  watchNeighbours(GUARD_URLS);
}
