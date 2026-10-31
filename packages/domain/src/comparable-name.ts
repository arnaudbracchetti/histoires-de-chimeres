/** Ordre naturel, en français : « Table 2 » avant « Table 10 », sans tenir compte de la casse ni des accents. */
const naturalOrder = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/**
 * Nom comparable : nom de table et pseudo (ID-7, PR-9). Deux noms sont le même nom quand ils ne
 * diffèrent que par la casse, les accents ou les espaces (au début, à la fin, ou plusieurs à la
 * suite) ; la ponctuation compte. Le nom garde le texte saisi pour l'affichage.
 */
export class ComparableName {
  private constructor(
    /** Le texte saisi, sans les espaces du début et de la fin. */
    readonly text: string,
    /** La forme qui sert à comparer : minuscules, sans accent, espaces réduits à un seul. */
    private readonly key: string,
  ) {}

  static createFromText(text: string): ComparableName {
    const trimmed = text.trim();
    const key = trimmed.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ');
    return new ComparableName(trimmed, key);
  }

  equals(other: ComparableName): boolean {
    return this.key === other.key;
  }

  /**
   * Pour `sort()` : l'ordre naturel. Deux noms qu'il ne départage pas gardent un ordre stable,
   * celui de leur texte, quel que soit l'ordre de lecture en base.
   */
  compareTo(other: ComparableName): number {
    return (
      naturalOrder.compare(this.text, other.text) ||
      (this.text < other.text ? -1 : this.text > other.text ? 1 : 0)
    );
  }
}
