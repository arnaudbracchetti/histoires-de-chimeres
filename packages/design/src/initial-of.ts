// Article de tête (le, la, les, l', un, une, des ; the, a, an), ignoré par la lettrine.
const LEADING_ARTICLE = /^(?:(?:le|la|les|un|une|des|the|an?)\s+|l['’]\s*)/i;

/** L'initiale de l'illustration par défaut d'un scénario : celle du premier mot après l'article de tête, en capitale. */
export function initialOf(title: string): string {
  const [initial] = title.trim().replace(LEADING_ARTICLE, '');
  return initial.toLocaleUpperCase('fr');
}
