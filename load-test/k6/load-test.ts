// Test de charge de l'API (docs/load-test/plan.md). Lancement : voir load-test/README.md.
import type { Options } from 'k6/options';
import { ARRIVAL, ARRIVAL_SECONDS, arrive } from './arrival.ts';
import { frontOffice, linkedPhone, pushSubscription } from './endpoints.ts';
import { GUARD, readGuardUrls, watchNeighbours } from './guard.ts';
import { prepareConvention, type PreparedConvention } from './preparation.ts';

/** Le nombre de téléphones : 1 pour la mesure de référence, puis 80, 160 et 240. */
const PHONE_COUNT = Number(__ENV.PHONES ?? '1');
/** La montée, puis la saisie la plus lente (15 s) et une marge. */
const ARRIVAL_MAX_SECONDS = ARRIVAL_SECONDS + 60;
/** La durée de toutes les phases : le garde-fou surveille jusqu'au bout. */
const TEST_SECONDS = ARRIVAL_MAX_SECONDS;
const GUARD_URLS = readGuardUrls();

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

export const options: Options = {
  // Un téléphone garde son cookie `linked-phone` d'une itération à l'autre.
  noCookiesReset: true,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  // La préparation fait environ 150 écritures, une à une.
  setupTimeout: '5m',
  scenarios: {
    [ARRIVAL]: {
      executor: 'per-vu-iterations',
      exec: 'runArrival',
      vus: PHONE_COUNT,
      iterations: 1,
      maxDuration: `${ARRIVAL_MAX_SECONDS}s`,
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
    ...Object.fromEntries(
      ARRIVAL_ENDPOINTS.map(({ name }) => [
        `http_req_duration{endpoint:${name},scenario:${ARRIVAL}}`,
        ['max>=0'],
      ]),
    ),
    // Arrêt d'urgence : plus de 20 % d'erreurs, refus attendus exclus. k6 calcule ce taux depuis le
    // début du test, pas sur une fenêtre glissante : il n'est jugé qu'après 30 s.
    http_req_failed: [{ threshold: 'rate<0.2', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

export function setup(): PreparedConvention {
  return prepareConvention();
}

export function runArrival(data: PreparedConvention): void {
  arrive(data, PHONE_COUNT);
}

export function runGuard(): void {
  watchNeighbours(GUARD_URLS);
}
