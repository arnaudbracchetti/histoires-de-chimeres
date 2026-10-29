/**
 * Typographie française de docs/design/ton.md, comme dans le back office. Les espaces spéciales ne
 * s'écrivent jamais en clair dans le code : invisibles, elles ne se relisent pas.
 */

/** Espace insécable (U+00A0) : devant « : », à l'intérieur des guillemets. */
export const NBSP = '\u00a0';

/** Espace fine insécable (U+202F) : devant « ; ! ? ». */
export const THIN_NBSP = '\u202f';

/**
 * Pose les espaces de ton.md dans le texte fixe d'une phrase : `` fr`Changer de pseudo ?` ``. Les
 * valeurs insérées restent telles quelles : un pseudo saisi n'est jamais réécrit.
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

/** « 30 caractères » : espace insécable entre le nombre et le nom. */
export function countOf(count: number, singular: string, plural: string): string {
  return `${count}${NBSP}${count > 1 ? plural : singular}`;
}
