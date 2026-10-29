import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { Convention } from './convention.js';
import { PresenceCode } from './presence-code.js';

function aConvention(): Convention {
  return Convention.restore({
    id: 'c1',
    name: 'Histoires de Chimères',
    date: null,
    timeSlots: [],
    tables: [],
    gameMasters: [],
    games: [],
    version: 0,
    presenceCode: PresenceCode.of('K7M2'),
  });
}

function refusalOf(action: () => void): Refusal {
  try {
    action();
  } catch (error) {
    if (error instanceof Refusal) return error;
    throw error;
  }
  throw new Error("L'action n'a pas été refusée.");
}

/** Les tables dans l'ordre affiché, en « identifiant nom ». */
const tablesOf = (convention: Convention) =>
  convention.tables.map((table) => `${table.id} ${table.name.text}`);

describe('Tables de la convention', () => {
  it('ajoute une table, avec le nom saisi sans les espaces du début et de la fin', () => {
    const convention = aConvention();

    convention.addTable('t1', '  Dragon ');

    expect(tablesOf(convention)).toEqual(['t1 Dragon']);
  });

  it('rend les tables dans l’ordre naturel : « Table 2 » avant « Table 10 »', () => {
    const convention = aConvention();
    for (const [id, name] of [
      ['t10', 'Table 10'],
      ['t2', 'Table 2'],
      ['d', 'Dragon'],
      ['t1', 'Table 1'],
    ] as const) {
      convention.addTable(id, name);
    }

    expect(tablesOf(convention)).toEqual(['d Dragon', 't1 Table 1', 't2 Table 2', 't10 Table 10']);
  });

  it.each(['Dragon', 'dragon', 'Dragón', '  Dragon  '])(
    'refuse « %s » quand « Dragon » existe : même nom (PR-9, ID-7)',
    (name) => {
      const convention = aConvention();
      convention.addTable('t1', 'Dragon');

      const refusal = refusalOf(() => convention.addTable('t2', name));

      expect(refusal.code).toBe('table-name-taken');
      expect(refusal.params).toEqual({ name: 'Dragon' });
      expect(tablesOf(convention)).toEqual(['t1 Dragon']);
    },
  );

  it('accepte « Salle 1 » à côté de « Salle-1 » : la ponctuation compte', () => {
    const convention = aConvention();
    convention.addTable('t1', 'Salle-1');

    convention.addTable('t2', 'Salle 1');

    expect(tablesOf(convention)).toHaveLength(2);
  });

  it('refuse un nom vide', () => {
    const convention = aConvention();

    expect(refusalOf(() => convention.addTable('t1', '   ')).code).toBe('table-name-required');
    expect(convention.tables).toEqual([]);
  });

  it('accepte un nom de 30 caractères, refuse un nom de 31', () => {
    const convention = aConvention();

    convention.addTable('t1', 'a'.repeat(30));
    const refusal = refusalOf(() => convention.addTable('t2', 'b'.repeat(31)));

    expect(refusal.code).toBe('table-name-too-long');
    expect(refusal.params).toEqual({ max: 30 });
    expect(tablesOf(convention)).toEqual([`t1 ${'a'.repeat(30)}`]);
  });

  describe('renommer', () => {
    it('change le nom, et la table reprend sa place dans l’ordre naturel', () => {
      const convention = aConvention();
      convention.addTable('t1', 'Table 1');
      convention.addTable('t2', 'Table 2');

      convention.renameTable('t1', 'Table 3');

      expect(tablesOf(convention)).toEqual(['t2 Table 2', 't1 Table 3']);
    });

    it('accepte le même nom écrit autrement : la table ne se compte pas elle-même', () => {
      const convention = aConvention();
      convention.addTable('t1', 'dragon');

      convention.renameTable('t1', 'Dragón');

      expect(tablesOf(convention)).toEqual(['t1 Dragón']);
    });

    it('refuse le nom d’une autre table, sans rien changer', () => {
      const convention = aConvention();
      convention.addTable('t1', 'Dragon');
      convention.addTable('t2', 'Licorne');

      const refusal = refusalOf(() => convention.renameTable('t2', 'DRAGON'));

      expect(refusal.code).toBe('table-name-taken');
      expect(tablesOf(convention)).toEqual(['t1 Dragon', 't2 Licorne']);
    });
  });

  it('supprime une table', () => {
    const convention = aConvention();
    convention.addTable('t1', 'Dragon');
    convention.addTable('t2', 'Licorne');

    convention.removeTable('t1');

    expect(tablesOf(convention)).toEqual(['t2 Licorne']);
  });

  it.each([
    ['la renommer', (c: Convention) => c.renameTable('x', 'Dragon')],
    ['la supprimer', (c: Convention) => c.removeTable('x')],
  ])('refuse de %s pour une table inconnue', (_, action) => {
    expect(refusalOf(() => action(aConvention())).code).toBe('table-not-found');
  });
});
