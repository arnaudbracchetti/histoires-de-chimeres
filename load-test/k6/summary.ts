// Les métriques du pic de publication (docs/load-test/plan.md § 7), tirées du résumé de k6 en
// fonctions pures : sans k6 ni réseau, elles se vérifient par Node seul.

/** Les noms des métriques propres au pic : les scénarios les écrivent, le résumé les lit. */
export const PUBLICATION_METRICS = {
  /** L'heure du poste, en ms, à la réponse de `publish`. */
  publishRespondedAt: 'publish_responded_at',
  /** Le début et la fin de chaque relecture d'une page ouverte, au pic, en ms. */
  peakReadStartedAt: 'peak_read_started_at',
  peakReadEndedAt: 'peak_read_ended_at',
  /** Un par téléphone abonné présent dans le tirage publié : il attend une notification. */
  pushExpected: 'push_expected',
  /** Les messages lisibles de fake-push juste avant `publish` : ceux des inscriptions. */
  pushReadableBeforePublish: 'push_readable_before_publish',
  /** Les compteurs de fake-push à la fin du test, et sa dernière réception, à l'heure du poste. */
  pushReadable: 'push_readable',
  pushUnreadable: 'push_unreadable',
  pushLastReceivedAt: 'push_last_received_at',
} as const;

/** Une métrique du résumé, telle que k6 la passe à `handleSummary()`. */
export type SummaryMetric = { type: string; contains?: string; values: Record<string, number> };
export type SummaryMetrics = Record<string, SummaryMetric | undefined>;

/** Les métriques du pic, `null` quand le test ne les a pas (phase seule, sans fake-push). */
export type PublicationMetrics = {
  /** De la réponse de `publish` à la fin de la dernière relecture d'une page ouverte. */
  peakDelayMs: number | null;
  /** De la première requête du pic à la fin de la dernière. */
  peakSpreadMs: number | null;
  /** Une relecture du pic est partie avant la réponse de `publish` : le pic était trop tôt. */
  peakStartedBeforePublishResponse: boolean | null;
  /** De la réponse de `publish` à la dernière réception dans fake-push. */
  notificationDurationMs: number | null;
  expectedNotifications: number | null;
  /** Les messages lisibles reçus par fake-push depuis la publication. */
  receivedNotifications: number | null;
  /** Les notifications attendues moins les reçues. */
  failedNotifications: number | null;
  unreadableNotifications: number | null;
};

export function computePublicationMetrics(metrics: SummaryMetrics): PublicationMetrics {
  const read = (name: string, stat: string) => metrics[name]?.values[stat] ?? null;
  const publishedAt = read(PUBLICATION_METRICS.publishRespondedAt, 'value');
  const firstPeakStart = read(PUBLICATION_METRICS.peakReadStartedAt, 'min');
  const lastPeakEnd = read(PUBLICATION_METRICS.peakReadEndedAt, 'max');
  const readableBefore = read(PUBLICATION_METRICS.pushReadableBeforePublish, 'value');
  const readableAtEnd = read(PUBLICATION_METRICS.pushReadable, 'value');
  const lastReceivedAt = read(PUBLICATION_METRICS.pushLastReceivedAt, 'value');

  const expected =
    publishedAt === null ? null : (read(PUBLICATION_METRICS.pushExpected, 'count') ?? 0);
  const received =
    publishedAt === null || readableBefore === null || readableAtEnd === null
      ? null
      : readableAtEnd - readableBefore;
  const subtract = (a: number | null, b: number | null) =>
    a === null || b === null ? null : a - b;
  return {
    peakDelayMs: subtract(lastPeakEnd, publishedAt),
    peakSpreadMs: subtract(lastPeakEnd, firstPeakStart),
    peakStartedBeforePublishResponse:
      publishedAt === null || firstPeakStart === null ? null : firstPeakStart < publishedAt,
    notificationDurationMs:
      received !== null && received > 0 ? subtract(lastReceivedAt, publishedAt) : null,
    expectedNotifications: expected,
    receivedNotifications: received,
    failedNotifications: subtract(expected, received),
    unreadableNotifications:
      received === null ? null : read(PUBLICATION_METRICS.pushUnreadable, 'value'),
  };
}

/** Les métriques qui portent des heures, pas des mesures : seul le JSON les garde. */
const CLOCK_METRICS = new Set<string>([
  PUBLICATION_METRICS.publishRespondedAt,
  PUBLICATION_METRICS.peakReadStartedAt,
  PUBLICATION_METRICS.peakReadEndedAt,
  PUBLICATION_METRICS.pushLastReceivedAt,
]);

/**
 * Le résumé en texte : les métriques du pic, puis chaque métrique de k6 par ordre alphabétique,
 * lignes par endpoint et par phase comprises. Écrit à la main : `handleSummary()` remplace le
 * résumé de k6, et la bibliothèque `k6-summary` se charge par le réseau.
 */
export function buildSummaryText(metrics: SummaryMetrics): string {
  const publication = computePublicationMetrics(metrics);
  const show = (value: number | boolean | null, unit = '') =>
    value === null ? 'sans objet' : `${String(value)}${unit}`;
  const lines = [
    'Pic de publication',
    `  délai du pic (réponse de publish → fin de la dernière relecture) : ${show(publication.peakDelayMs, ' ms')}`,
    `  écart entre la première et la dernière requête du pic : ${show(publication.peakSpreadMs, ' ms')}`,
    `  relecture du pic partie avant la réponse de publish : ${show(publication.peakStartedBeforePublishResponse)}`,
    `  durée d'envoi des notifications (réponse de publish → dernière réception) : ${show(publication.notificationDurationMs, ' ms')}`,
    `  notifications attendues : ${show(publication.expectedNotifications)}`,
    `  notifications reçues depuis la publication : ${show(publication.receivedNotifications)}`,
    `  échecs (attendues - reçues) : ${show(publication.failedNotifications)}`,
    `  messages illisibles : ${show(publication.unreadableNotifications)}`,
    '',
    'Métriques',
  ];
  for (const name of Object.keys(metrics).sort()) {
    const metric = metrics[name];
    if (metric === undefined || CLOCK_METRICS.has(name)) continue;
    lines.push(`  ${name} : ${formatValues(metric)}`);
  }
  return `${lines.join('\n')}\n`;
}

function formatValues({ type, contains, values }: SummaryMetric): string {
  const unit = contains === 'time' ? ' ms' : '';
  const round = (value: number) => String(Math.round(value * 100) / 100);
  if (type === 'rate') {
    return `${round((values.rate ?? 0) * 100)} % (${values.passes ?? 0} sur ${(values.passes ?? 0) + (values.fails ?? 0)})`;
  }
  return Object.entries(values)
    .map(
      ([stat, value]) =>
        `${stat}=${round(value)}${stat === 'count' || stat === 'rate' ? '' : unit}`,
    )
    .join(' ');
}
