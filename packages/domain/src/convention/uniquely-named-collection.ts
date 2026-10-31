import type { ComparableName } from '../comparable-name.js';
import type { Refusal } from '../refusal.js';

/**
 * Les règles d'un nom unique : comment lire le nom d'un élément, sa longueur maximale, et le refus
 * de chaque motif. Les refus viennent de l'appelant, qui connaît ses codes.
 */
export type NamingRules<T> = {
  getName: (item: T) => ComparableName;
  maxLength: number;
  refuseMissingItem: () => Refusal;
  refuseEmptyName: () => Refusal;
  refuseTooLongName: (max: number) => Refusal;
  /** `namesake` : l'élément qui porte déjà ce nom. */
  refuseTakenName: (namesake: T) => Refusal;
};

/**
 * Des éléments dont le nom est obligatoire, borné et unique parmi eux : les tables (PR-9) et les MJ
 * (PR-12, ID-7). Rendus dans l'ordre naturel de leur nom. Immuable : chaque geste rend une autre
 * collection.
 */
export class UniquelyNamedCollection<T extends { readonly id: string }> {
  private constructor(
    private readonly items: readonly T[],
    private readonly rules: NamingRules<T>,
  ) {}

  /** `items`, dans n'importe quel ordre. */
  static createFromItems<T extends { readonly id: string }>(
    items: Iterable<T>,
    rules: NamingRules<T>,
  ): UniquelyNamedCollection<T> {
    return new UniquelyNamedCollection([...items], rules);
  }

  /** Les éléments, dans l'ordre naturel de leur nom : « Table 2 » avant « Table 10 ». */
  get itemsInNaturalOrder(): readonly T[] {
    return [...this.items].sort((a, b) => this.rules.getName(a).compareTo(this.rules.getName(b)));
  }

  /** L'élément, qui doit exister. */
  findExistingItemById(id: string): T {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) throw this.rules.refuseMissingItem();
    return item;
  }

  /** L'élément qui porte ce nom, à la comparaison de `ComparableName` près, ou `undefined`. */
  findItemWithSameName(name: ComparableName): T | undefined {
    return this.items.find((item) => this.rules.getName(item).equals(name));
  }

  verifyItemExists(id: string): void {
    this.findExistingItemById(id);
  }

  /** La collection après l'ajout d'un élément, dont le nom doit être valide et libre. */
  getCollectionAfterAddingItem(item: T): UniquelyNamedCollection<T> {
    return new UniquelyNamedCollection([...this.items, this.verifyNameValidAndFree(item)], this.rules);
  }

  /**
   * La collection après le remplacement de l'élément de même id, qui doit exister, par `item`, dont
   * le nom doit être valide et libre.
   */
  getCollectionAfterReplacingItem(item: T): UniquelyNamedCollection<T> {
    this.verifyItemExists(item.id);
    const verified = this.verifyNameValidAndFree(item);
    return this.getCollectionAfterReplacingEachItem((current) => (current.id === item.id ? verified : current));
  }

  /** La collection après le remplacement de chaque élément par `replace(élément)`, du même nom. */
  getCollectionAfterReplacingEachItem(replace: (item: T) => T): UniquelyNamedCollection<T> {
    return new UniquelyNamedCollection(this.items.map(replace), this.rules);
  }

  /** La collection après le retrait d'un élément, qui doit exister. */
  getCollectionAfterRemovingItem(id: string): UniquelyNamedCollection<T> {
    this.verifyItemExists(id);
    return new UniquelyNamedCollection(
      this.items.filter((item) => item.id !== id),
      this.rules,
    );
  }

  /** Vérifie le nom de `candidate` : obligatoire, borné, et porté par aucun autre élément. */
  private verifyNameValidAndFree(candidate: T): T {
    const name = this.rules.getName(candidate);
    if (!name.text) throw this.rules.refuseEmptyName();
    if (name.text.length > this.rules.maxLength) {
      throw this.rules.refuseTooLongName(this.rules.maxLength);
    }
    const namesake = this.items.find(
      (item) => item.id !== candidate.id && this.rules.getName(item).equals(name),
    );
    if (namesake) throw this.rules.refuseTakenName(namesake);
    return candidate;
  }
}
