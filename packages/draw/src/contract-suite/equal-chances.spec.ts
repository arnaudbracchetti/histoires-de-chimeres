import type { DrawAlgorithm } from '@chimeres/domain';
import { describe, expect, it } from 'vitest';
import { ExhaustiveDrawAlgorithm } from '../exhaustive-draw-algorithm.js';
import { EQUAL_CHANCES_SLOTS } from './draw-algorithm-contract.js';
import { listUnequalChances } from './equal-chances.js';

// Le test « mêmes inscriptions, mêmes chances » doit voir un algorithme qui favorise l'ordre de l'entrée.

/**
 * Le premier algorithme, privé de hasard (toujours 0) : son mélange rend toujours le même ordre, et
 * il garde toujours le premier ex aequo. Le résultat ne change plus d'un tirage à l'autre.
 */
const withoutRandomness: DrawAlgorithm = {
  computeAssignments: (input) => new ExhaustiveDrawAlgorithm().computeAssignments(input, () => 0),
};

describe('listUnequalChances', () => {
  it.each(Object.keys(EQUAL_CHANCES_SLOTS))(
    'voit qu’un algorithme sans mélange, privé de hasard, favorise certains participants : %s',
    (slot) => {
      expect(
        listUnequalChances(withoutRandomness, EQUAL_CHANCES_SLOTS[slot]!, 2000, 2026),
      ).not.toEqual([]);
    },
  );

  it('décrit l’écart : sans mélange, les deux mêmes joueurs sur 6 vont toujours à B, au lieu d’un tirage sur trois', () => {
    const input = EQUAL_CHANCES_SLOTS['6 inscrits aux deux parties, répartis sur les deux tables']!;
    const unequal = listUnequalChances(withoutRandomness, input, 2000, 2026);
    const alwaysAtB = unequal.filter(({ outcome, share }) => outcome === 'B' && share === 1);
    expect(alwaysAtB).toHaveLength(2);
    expect(alwaysAtB[0]!.groupShare).toBeCloseTo(1 / 3);
  });
});
