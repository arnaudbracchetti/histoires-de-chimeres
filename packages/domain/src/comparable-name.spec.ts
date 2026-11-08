import { describe, expect, it } from 'vitest';
import { ComparableName } from './comparable-name.js';

const name = ComparableName.createFromText;

describe('ComparableName (ID-7, PR-9)', () => {
  it.each(['dragon', 'Dragón', '  Dragon  ', 'DRAGON'])(
    '« Dragon » et « %s » sont le même nom',
    (other) => {
      expect(name('Dragon').equals(name(other))).toBe(true);
    },
  );

  it('ignore plusieurs espaces à la suite', () => {
    expect(name('Table   du  fond').equals(name('Table du fond'))).toBe(true);
  });

  it.each([
    ['Salle-1', 'Salle 1'],
    ['Jean-Luc', 'Jean Luc'],
    ['Dragon.', 'Dragon'],
  ])('la ponctuation compte : « %s » et « %s » sont deux noms', (a, b) => {
    expect(name(a).equals(name(b))).toBe(false);
  });

  it('garde le texte saisi pour l’affichage, sans les espaces du début et de la fin', () => {
    expect(name('  Dragón  du Nord ').text).toBe('Dragón  du Nord');
  });

  it.each(['elo', 'ÉLO', ' lodi ', 'die  du', 'Élodie du Nord'])(
    '« Élodie du Nord » contient « %s » (ID-5, ID-7)',
    (fragment) => {
      expect(name('Élodie du Nord').contains(name(fragment))).toBe(true);
    },
  );

  it.each(['Jean Luc', 'Jean-Luc.', 'Lucien'])(
    'la ponctuation compte : « Jean-Luc » ne contient pas « %s »',
    (fragment) => {
      expect(name('Jean-Luc').contains(name(fragment))).toBe(false);
    },
  );

  it('range dans l’ordre naturel : « Table 2 » avant « Table 10 »', () => {
    const names = ['Table 10', 'table 1', 'Table 2', 'Dragon', 'Élan'].map(name);

    expect(names.sort((a, b) => a.compareTo(b)).map(({ text }) => text)).toEqual([
      'Dragon',
      'Élan',
      'table 1',
      'Table 2',
      'Table 10',
    ]);
  });
});
