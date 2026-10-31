/**
 * Typographie française de docs/design/ton.md. Les espaces spéciales ne s'écrivent jamais en clair
 * dans le code : invisibles, elles ne se relisent pas (`check-typography`, lancé par `pnpm lint`, le
 * vérifie).
 */

/** Espace insécable (U+00A0) : dans « 14 h 00 », devant « : », à l'intérieur des guillemets. */
export const NBSP = '\u00a0';

/** Espace fine insécable (U+202F) : devant « ; ! ? », autour du tiret d'une plage, dans « 1 500 ». */
export const THIN_NBSP = '\u202f';

/**
 * Pose les espaces de ton.md dans le texte fixe d'une phrase : `` fr`Supprimer le scénario « ${title} » ?` ``.
 * Les espaces ordinaires à l'intérieur des guillemets et devant « : » deviennent insécables, celles
 * devant « ; ! ? » fines insécables. Les valeurs insérées restent telles quelles : un titre saisi
 * n'est jamais réécrit.
 */
export function fr(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce(
    (text, part, index) =>
      text + frenchSpaces(part) + (index < values.length ? String(values[index]) : ''),
    '',
  );
}

function frenchSpaces(part: string): string {
  return part
    .replace(/« /g, `«${NBSP}`)
    .replace(/ »/g, `${NBSP}»`)
    .replace(/ :/g, `${NBSP}:`)
    .replace(/ ([;!?])/g, `${THIN_NBSP}$1`);
}

/** « 1 500 » : espace fine insécable pour les milliers. */
export function formatCount(count: number): string {
  return count.toLocaleString('fr-FR').replace(/\s/g, THIN_NBSP);
}

/** Le nom accordé au nombre : singulier pour 0 et 1, pluriel à partir de 2. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return count > 1 ? pluralForm : singular;
}

/** « 1 place », « 4 places », « 1 500 caractères » : espace insécable entre le nombre et le nom. */
export function countOf(count: number, singular: string, pluralForm: string): string {
  return `${formatCount(count)}${NBSP}${plural(count, singular, pluralForm)}`;
}

/** « 3 à 5 places », ou « 4 places » quand minimum et maximum sont égaux : les places d'un scénario. */
export function formatSeats({ min, max }: { min: number; max: number }): string {
  if (min === max) return countOf(min, 'place', 'places');
  return `${formatCount(min)} à ${formatCount(max)}${NBSP}places`;
}

const LIST = new Intl.ListFormat('fr', { type: 'conjunction' });

/** « Dragon », « Dragon et Licorne », « Dragon, Licorne et Griffon ». */
export function formatList(items: readonly string[]): string {
  return LIST.format(items);
}
