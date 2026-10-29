const FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * « samedi 13 mars 2027 », « samedi 1er mai 2027 », ou « date à fixer » (docs/design/ton.md).
 * `date` est en `AAAA-MM-JJ`.
 */
export function formatConventionDate(date: string | null): string {
  if (date === null) return 'date à fixer';
  return FORMAT.formatToParts(new Date(`${date}T00:00:00Z`))
    .map(({ type, value }) => (type === 'day' && value === '1' ? '1er' : value))
    .join('');
}
