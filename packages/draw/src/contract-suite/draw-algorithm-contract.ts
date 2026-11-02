import type { DrawAlgorithm, DrawInput, DrawOutput } from '@chimeres/domain';
import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../seeded-random.js';
import { aDrawInput, aGame, aRandomDrawInput } from './draw-inputs.js';
import { listUnequalChances } from './equal-chances.js';

/**
 * La suite de tests de contrat (ADR 0014), que tout algorithme de tirage doit passer. Un algorithme
 * l'appelle depuis sa spec, en plus de ses tests propres.
 */
export function describeDrawAlgorithmContract(algorithm: DrawAlgorithm): void {
  describe('contrat de DrawAlgorithm (TI-4)', () => {
    it('respecte les règles absolues sur 300 créneaux au hasard : chacun une fois, jamais au-delà du maximum, seulement sur ses inscriptions', () => {
      const random = createSeededRandom(2026);
      for (let run = 0; run < 300; run++) {
        const input = aRandomDrawInput(random);
        const output = algorithm.computeAssignments(input, random);
        expect(listBrokenRules(input, output), JSON.stringify(input)).toEqual([]);
      }
    });

    it.each(Object.entries(EQUAL_CHANCES_SLOTS))(
      'donne les mêmes chances aux participants inscrits aux mêmes parties, sur 2 000 tirages : %s',
      (_, input) => {
        expect(listUnequalChances(algorithm, input, 2000, 2026)).toEqual([]);
      },
    );

    it('ne place pas un participant sans partie', () => {
      const input = aDrawInput([aGame('A', 1, 4)], { A: 2, '': 1 });
      const output = algorithm.computeAssignments(input, createSeededRandom(1));
      expect(output).toContainEqual({ participantId: 'p3', gameId: null });
    });

    it('ne place personne sur un créneau sans partie', () => {
      const input = aDrawInput([], { '': 2 });
      const output = algorithm.computeAssignments(input, createSeededRandom(1));
      expect(output).toHaveLength(2);
      expect(output).toEqual(
        expect.arrayContaining([
          { participantId: 'p1', gameId: null },
          { participantId: 'p2', gameId: null },
        ]),
      );
    });

    it('rend une sortie vide pour une entrée vide', () => {
      const output = algorithm.computeAssignments(
        { games: [], participants: [] },
        createSeededRandom(1),
      );
      expect(output).toEqual([]);
    });
  });
}

/**
 * Les créneaux du test « mêmes inscriptions, mêmes chances ». Chacun coupe des groupes en deux : des
 * membres placés et d'autres non, ou répartis sur deux tables. Sinon, un algorithme qui ignore le
 * hasard passerait.
 */
export const EQUAL_CHANCES_SLOTS: Record<string, DrawInput> = {
  '10 inscrits pour 7 places': aDrawInput([aGame('A', 2, 4), aGame('B', 2, 3)], {
    A: 5,
    AB: 3,
    B: 2,
  }),
  '17 inscrits pour 14 places, dont une partie très demandée': aDrawInput(
    [aGame('A', 3, 5), aGame('B', 3, 5), aGame('C', 3, 4)],
    { A: 8, AB: 4, BC: 3, C: 2 },
  ),
  '24 inscrits pour 20 places, presque tous sur plusieurs parties': aDrawInput(
    [aGame('A', 3, 5), aGame('B', 3, 5), aGame('C', 3, 6), aGame('D', 2, 4)],
    { AB: 6, BC: 5, CD: 4, AD: 4, ABCD: 3, D: 2 },
  ),
  '6 inscrits aux deux parties, répartis sur les deux tables': aDrawInput(
    [aGame('A', 2, 6), aGame('B', 2, 3)],
    { AB: 6 },
  ),
};

/** Les règles absolues de TI-4 qu'une sortie enfreint, en clair pour le message d'échec. */
function listBrokenRules(input: DrawInput, output: DrawOutput): string[] {
  const broken: string[] = [];
  for (const participant of input.participants) {
    const assignments = output.filter(({ participantId }) => participantId === participant.id);
    if (assignments.length !== 1) {
      broken.push(`${participant.id} figure ${assignments.length} fois dans la sortie`);
    }
    for (const { gameId } of assignments) {
      if (gameId !== null && !participant.gameIds.includes(gameId)) {
        broken.push(`${participant.id} est placé sur ${gameId}, où il n'est pas inscrit`);
      }
    }
  }
  for (const { participantId } of output) {
    if (!input.participants.some(({ id }) => id === participantId)) {
      broken.push(`${participantId} n'est pas un participant de l'entrée`);
    }
  }
  for (const game of input.games) {
    const playerCount = output.filter(({ gameId }) => gameId === game.id).length;
    if (playerCount > game.maxSeats) {
      broken.push(`${game.id} a ${playerCount} joueurs pour ${game.maxSeats} places au plus`);
    }
  }
  return broken;
}
