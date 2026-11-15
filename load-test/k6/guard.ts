// Le garde-fou (docs/load-test/plan.md § 8) : test2 partage sa machine avec la production et
// d'autres services. Si l'un d'eux ralentit ou tombe, le test s'arrête.
import http from 'k6/http';
import exec from 'k6/execution';
import { sleep } from 'k6';

export const GUARD = 'guard';
/** Intervalle entre deux tours de surveillance. */
const GUARD_INTERVAL_SECONDS = 5;
/** Au-delà de cette durée, ou sur un échec, le test s'arrête. */
const GUARD_TIMEOUT_MS = 2000;

/**
 * Les URL surveillées : `GUARD_URLS`, séparées par des virgules, réglées sur le poste (l'`/api/health`
 * de la production, puis les autres services de la machine). Vide : pas de garde-fou.
 */
export function readGuardUrls(): string[] {
  return (__ENV.GUARD_URLS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url !== '');
}

/**
 * Un tour de surveillance : chaque URL doit répondre en succès en moins de 2 s, sinon le test
 * s'arrête. Le tour suivant part 5 s plus tard.
 */
export function watchNeighbours(urls: string[]): void {
  for (const url of urls) {
    const response = http.get(url, {
      timeout: `${GUARD_TIMEOUT_MS}ms`,
      tags: { endpoint: GUARD, scenario: GUARD, url },
      // Un échec ici arrête le test : il ne doit pas compter en plus dans `http_req_failed`.
      responseCallback: http.expectedStatuses({ min: 0, max: 599 }),
    });
    const failed = response.error_code !== 0 || response.status < 200 || response.status > 299;
    if (failed || response.timings.duration > GUARD_TIMEOUT_MS) {
      exec.test.abort(
        `Garde-fou : ${url} répond ${failed ? `en échec (${response.status} ${response.error})` : `en ${Math.round(response.timings.duration)} ms`}.`,
      );
    }
  }
  sleep(GUARD_INTERVAL_SECONDS);
}
