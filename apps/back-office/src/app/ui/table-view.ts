import { computed, signal, type Signal, type WritableSignal } from '@angular/core';

/** La colonne triée, et son sens. */
export type TableSort<K extends string = string> = { column: K; descending: boolean };

/** Ce que lit un en-tête triable (`th[appSortable]`) : la colonne triée, le geste qui trie. */
export interface SortControl<K extends string = string> {
  readonly sort: Signal<TableSort<K>>;
  sortBy(column: K): void;
  ariaSort(column: K): 'ascending' | 'descending' | null;
}

export type TableViewOptions<T, K extends string> = {
  /** La liste lue, dans n'importe quel ordre ; elle n'est jamais modifiée. */
  items: () => readonly T[];
  /** Les textes d'une ligne où cherche le filtre : « Kaïros » se trouve par « kairos ». */
  searchIn: (item: T) => readonly string[];
  /** Les colonnes triables, chacune avec le texte qu'elle compare. */
  sortKeys: Record<K, (item: T) => string>;
  /** La colonne triée à l'ouverture, à l'endroit. */
  initialSort: NoInfer<K>;
};

export interface TableView<T, K extends string> extends SortControl<K> {
  /** Les lignes à afficher : filtrées, puis triées. */
  readonly rows: Signal<T[]>;
  /** Le texte du filtre, lié au champ `app-table-filter`. */
  readonly filter: WritableSignal<string>;
  /** Vide le filtre : toutes les lignes reviennent. */
  clear(): void;
}

/** L'ordre naturel, comme celui du domaine : « Scénario 2 » avant « Scénario 10 », sans casse ni accent. */
const NATURAL = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/** Forme de recherche d'un texte : sans casse, sans accent, espaces réduits. */
function searchKey(text: string): string {
  return text.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Filtre et tri d'un tableau (docs/design/patterns.md, Tableaux), en signaux, côté front et sans
 * DOM : le composant garde son `<table>` et lit `rows()`. Le filtre cherche sans casse ni accent
 * dans les textes de `searchIn` ; le tri suit l'ordre naturel ; une seconde demande sur la même
 * colonne l'inverse. À créer dans un champ du composant, comme `apiResource()`.
 */
export function tableView<T, K extends string>({
  items,
  searchIn,
  sortKeys,
  initialSort,
}: TableViewOptions<T, K>): TableView<T, K> {
  const filter = signal('');
  const sort = signal<TableSort<K>>({ column: initialSort, descending: false });

  const rows = computed(() => {
    const key = searchKey(filter());
    const shown = items().filter((item) =>
      searchIn(item).some((text) => searchKey(text).includes(key)),
    );
    const { column, descending } = sort();
    const keyOf = sortKeys[column];
    const sorted = shown.sort((a, b) => NATURAL.compare(keyOf(a), keyOf(b)));
    return descending ? sorted.reverse() : sorted;
  });

  return {
    rows,
    filter,
    sort: sort.asReadonly(),
    sortBy(column) {
      const current = sort();
      sort.set({ column, descending: current.column === column && !current.descending });
    },
    ariaSort(column) {
      const current = sort();
      if (current.column !== column) return null;
      return current.descending ? 'descending' : 'ascending';
    },
    clear() {
      filter.set('');
    },
  };
}
