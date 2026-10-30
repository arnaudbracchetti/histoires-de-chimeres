const FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const DAY_AND_MONTH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/** Le premier du mois s'écrit « 1er ». */
function withFirst(format: Intl.DateTimeFormat, date: Date): string {
  return format
    .formatToParts(date)
    .map(({ type, value }) => (type === 'day' && value === '1' ? '1er' : value))
    .join('');
}

/**
 * « samedi 13 mars 2027 », « samedi 1er mai 2027 », ou « date à fixer » (docs/design/ton.md).
 * `date` est en `AAAA-MM-JJ`.
 */
export function formatConventionDate(date: string | null): string {
  if (date === null) return 'date à fixer';
  return withFirst(FORMAT, new Date(`${date}T00:00:00Z`));
}

/** « 26 octobre », « 1er mai » : le jour d'un instant, à l'heure locale. */
export function formatDayAndMonth(instant: Date): string {
  return withFirst(DAY_AND_MONTH, instant);
}
