import { signal } from '@angular/core';
import { tableView } from './table-view';

type Row = { title: string; system: string };

const row = (title: string, system = ''): Row => ({ title, system });

function viewOf(...rows: Row[]) {
  const items = signal(rows);
  const view = tableView({
    items,
    searchIn: ({ title, system }) => [title, system],
    sortKeys: { title: ({ title }) => title, system: ({ system }) => system },
    initialSort: 'title',
  });
  const titles = () => view.rows().map(({ title }) => title);
  return { items, view, titles };
}

describe('tableView', () => {
  it('trie d’abord sur la colonne initiale, dans l’ordre naturel', () => {
    const { titles } = viewOf(row('Scénario 10'), row('zénith'), row('Scénario 2'));

    expect(titles()).toEqual(['Scénario 2', 'Scénario 10', 'zénith']);
  });

  it('trie à l’envers sur la même colonne, puis à l’endroit sur une nouvelle', () => {
    const { view, titles } = viewOf(row('B', 'Alien'), row('A', 'Pendragon'), row('C', 'Cthulhu'));

    view.sortBy('title');
    expect(titles()).toEqual(['C', 'B', 'A']);
    expect(view.sort()).toEqual({ column: 'title', descending: true });

    view.sortBy('system');
    expect(titles()).toEqual(['B', 'C', 'A']);
    expect(view.sort()).toEqual({ column: 'system', descending: false });
  });

  it('dit le sens du tri pour aria-sort, et rien pour une colonne non triée', () => {
    const { view } = viewOf(row('A'));

    expect(view.ariaSort('title')).toBe('ascending');
    expect(view.ariaSort('system')).toBeNull();
    view.sortBy('title');
    expect(view.ariaSort('title')).toBe('descending');
  });

  it('filtre sur chaque texte de la ligne, sans casse, sans accent, espaces réduits', () => {
    const { view, titles } = viewOf(row('Élodie', 'Alien'), row('Kaïros', 'Pendragon'));

    view.filter.set('  ELOD ');
    expect(titles()).toEqual(['Élodie']);

    view.filter.set('pendragon');
    expect(titles()).toEqual(['Kaïros']);

    view.filter.set('kairos');
    expect(titles()).toEqual(['Kaïros']);
  });

  it('vide le filtre par clear()', () => {
    const { view, titles } = viewOf(row('A'), row('B'));
    view.filter.set('zorglub');
    expect(titles()).toEqual([]);

    view.clear();

    expect(view.filter()).toBe('');
    expect(titles()).toEqual(['A', 'B']);
  });

  it('suit la liste lue, sans la modifier', () => {
    const { items, titles } = viewOf(row('B'), row('A'));

    items.set([row('D'), row('C')]);

    expect(titles()).toEqual(['C', 'D']);
    expect(items().map(({ title }) => title)).toEqual(['D', 'C']);
  });
});
