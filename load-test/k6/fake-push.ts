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
