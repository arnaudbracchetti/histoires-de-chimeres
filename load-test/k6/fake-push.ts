// Le faux service de push, vu de k6 (docs/load-test/plan.md § 6) : son port d'administration,
// joint par le tunnel SSH que run.sh ouvre.
import http from 'k6/http';
import type { PushSubscriptionBody } from '../../packages/contract/dist/index.js';

/**
 * L'adresse du port d'administration de fake-push, sans `/` final : `FAKE_PUSH_URL`, posée par
 * run.sh. Sans elle, les téléphones ne s'abonnent pas au push (mise au point sans serveur).
 */
export const FAKE_PUSH_URL = __ENV.FAKE_PUSH_URL?.replace(/\/$/, '') || null;

/** Un abonnement neuf, tel que le navigateur le donnerait au front office. */
export function requestFakePushSubscription(
  fakePushUrl: string,
  phase: string,
): PushSubscriptionBody {
  const response = http.post(`${fakePushUrl}/subscriptions`, null, {
    tags: { endpoint: 'fakePush.subscribe', scenario: phase },
  });
  if (response.status !== 201) {
    throw new Error(`fake-push : ${response.status} ${String(response.body)}`);
  }
  return response.json() as PushSubscriptionBody;
}

/**
 * Les compteurs de fake-push, et sa dernière réception à l'heure du poste. fake-push date ses
 * réceptions à l'heure du serveur, et rend aussi l'heure de sa réponse (`now`) : l'écart entre les
 * deux horloges s'estime au milieu de l'aller-retour, à la latence du tunnel près.
 */
export type FakePushCounts = {
  readable: number;
  unreadable: number;
  /** En ms, à l'heure du poste ; `null` sans réception. */
  lastReceivedAtMs: number | null;
};

export function readFakePushCounts(fakePushUrl: string, phase: string): FakePushCounts {
  const sentAtMs = Date.now();
  const response = http.get(`${fakePushUrl}/stats`, {
    tags: { endpoint: 'fakePush.stats', scenario: phase },
  });
  const receivedAtMs = Date.now();
  if (response.status !== 200) {
    throw new Error(`fake-push : ${response.status} ${String(response.body)}`);
  }
  const stats = response.json() as {
    readable: number;
    unreadable: number;
    lastReceivedAt: string | null;
    now: string;
  };
  const serverAheadMs = Date.parse(stats.now) - (sentAtMs + receivedAtMs) / 2;
  return {
    readable: stats.readable,
    unreadable: stats.unreadable,
    lastReceivedAtMs:
      stats.lastReceivedAt === null ? null : Date.parse(stats.lastReceivedAt) - serverAheadMs,
  };
}
