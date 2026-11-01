import { describe, expect, it } from 'vitest';
import { formatAgeLine } from './age-line.js';
import { NBSP } from './french.js';

describe('Ligne d’âge', () => {
  const readAt = new Date(2027, 2, 14, 14, 5);

  it('ne dit rien tant que la donnée a 2 minutes ou moins', () => {
    expect(formatAgeLine(readAt, new Date(2027, 2, 14, 14, 7))).toBeNull();
  });

  it('dit l’heure de la dernière lecture au-delà de 2 minutes, le même jour', () => {
    expect(formatAgeLine(readAt, new Date(2027, 2, 14, 14, 7, 1))).toBe(
      `Pas de connexion · à jour à 14${NBSP}h${NBSP}05`,
    );
  });

  it('dit aussi le jour de la dernière lecture un autre jour', () => {
    expect(formatAgeLine(new Date(2027, 2, 13, 18, 5), new Date(2027, 2, 14, 8, 0))).toBe(
      `Pas de connexion · à jour le 13 mars à 18${NBSP}h${NBSP}05`,
    );
  });
});
