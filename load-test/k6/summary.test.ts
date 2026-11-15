// Les métriques du pic de publication, tirées du résumé de k6 (docs/load-test/plan.md § 7).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePublicationMetrics, type SummaryMetrics } from './summary.ts';

const PUBLISHED_AT = 1_800_000_000_000;

/** Les métriques du résumé, telles que k6 les passe à `handleSummary()`. */
function buildMetrics(overrides: SummaryMetrics = {}): SummaryMetrics {
  return {
    publish_responded_at: { type: 'gauge', values: { value: PUBLISHED_AT } },
    peak_read_started_at: {
      type: 'trend',
      values: { min: PUBLISHED_AT + 1_500, max: PUBLISHED_AT + 3_400 },
    },
    peak_read_ended_at: {
      type: 'trend',
      values: { min: PUBLISHED_AT + 1_600, max: PUBLISHED_AT + 3_900 },
    },
    push_expected: { type: 'counter', values: { count: 80 } },
    push_readable_before_publish: { type: 'gauge', values: { value: 3 } },
    push_readable: { type: 'gauge', values: { value: 81 } },
    push_unreadable: { type: 'gauge', values: { value: 0 } },
    push_last_received_at: { type: 'gauge', values: { value: PUBLISHED_AT + 1_250 } },
    ...overrides,
  };
}

describe('Les métriques du pic de publication', () => {
  it('mesure le délai du pic, de la réponse de publish à la fin de la dernière relecture', () => {
    assert.equal(computePublicationMetrics(buildMetrics()).peakDelayMs, 3_900);
  });

  it("mesure l'écart entre la première et la dernière requête du pic", () => {
    assert.equal(computePublicationMetrics(buildMetrics()).peakSpreadMs, 2_400);
  });

  it('signale un pic parti avant la réponse de publish', () => {
    assert.equal(computePublicationMetrics(buildMetrics()).peakStartedBeforePublishResponse, false);
    const early = buildMetrics({
      peak_read_started_at: {
        type: 'trend',
        values: { min: PUBLISHED_AT - 200, max: PUBLISHED_AT },
      },
    });
    assert.equal(computePublicationMetrics(early).peakStartedBeforePublishResponse, true);
  });

  it("mesure la durée d'envoi, de la réponse de publish à la dernière réception", () => {
    assert.equal(computePublicationMetrics(buildMetrics()).notificationDurationMs, 1_250);
  });

  it('compte les notifications reçues depuis la publication, et les échecs', () => {
    const metrics = computePublicationMetrics(
      buildMetrics({ push_readable: { type: 'gauge', values: { value: 80 } } }),
    );
    assert.equal(metrics.expectedNotifications, 80);
    assert.equal(metrics.receivedNotifications, 77);
    assert.equal(metrics.failedNotifications, 3);
    assert.equal(metrics.unreadableNotifications, 0);
  });

  it("ne donne aucune durée d'envoi quand aucune notification n'est arrivée après la publication", () => {
    const metrics = computePublicationMetrics(
      buildMetrics({
        push_readable: { type: 'gauge', values: { value: 3 } },
        push_last_received_at: { type: 'gauge', values: { value: PUBLISHED_AT - 60_000 } },
      }),
    );
    assert.equal(metrics.notificationDurationMs, null);
    assert.equal(metrics.failedNotifications, 80);
  });

  it('ne donne rien du pic sans publication (phase lancée seule)', () => {
    const metrics = computePublicationMetrics({});
    assert.equal(metrics.peakDelayMs, null);
    assert.equal(metrics.peakSpreadMs, null);
    assert.equal(metrics.notificationDurationMs, null);
    assert.equal(metrics.expectedNotifications, null);
    assert.equal(metrics.failedNotifications, null);
  });

  it('ne compte pas les notifications sans fake-push (mise au point)', () => {
    const metrics = computePublicationMetrics(
      buildMetrics({
        push_readable_before_publish: undefined,
        push_readable: undefined,
        push_unreadable: undefined,
        push_last_received_at: undefined,
      }),
    );
    assert.equal(metrics.peakDelayMs, 3_900);
    assert.equal(metrics.receivedNotifications, null);
    assert.equal(metrics.failedNotifications, null);
    assert.equal(metrics.notificationDurationMs, null);
  });
});
