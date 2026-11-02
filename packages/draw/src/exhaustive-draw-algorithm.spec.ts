import type { DrawInput, DrawOutput } from '@chimeres/domain';
import { describe, expect, it } from 'vitest';
import { describeDrawAlgorithmContract } from './contract-suite/draw-algorithm-contract.js';
import { aDrawInput, aGame } from './contract-suite/draw-inputs.js';
import { ExhaustiveDrawAlgorithm } from './exhaustive-draw-algorithm.js';
import { createSeededRandom } from './seeded-random.js';

const algorithm = new ExhaustiveDrawAlgorithm();

describeDrawAlgorithmContract(algorithm);

/** Le même créneau tiré avec les graines 1 à 20 : une règle de l'algorithme vaut pour chaque tirage. */
function drawTwentyTimes(input: DrawInput): DrawOutput[] {
  return Array.from({ length: 20 }, (_, index) =>
    algorithm.computeAssignments(input, createSeededRandom(index + 1)),
  );
}

/** Les joueurs de chaque partie de l'entrée. */
function countPlayersPerGame(input: DrawInput, output: DrawOutput): Record<string, number> {
  return Object.fromEntries(
    input.games.map((game) => [game.id, output.filter(({ gameId }) => gameId === game.id).length]),
  );
}

/**
 * Un créneau à taille réelle : 80 inscrits, 5 parties, 31 places. Chacun s'inscrit à chaque partie
 * selon sa popularité, et à une partie au hasard s'il n'en a pris aucune.
 */
function aRealSizeDrawInput(): DrawInput {
  const games = [
    aGame('A', 3, 6),
    aGame('B', 3, 6),
    aGame('C', 4, 8),
    aGame('D', 2, 5),
    aGame('E', 3, 6),
  ];
  const popularity = [0.5, 0.3, 0.25, 0.15, 0.2];
  const random = createSeededRandom(80);
  const participants = Array.from({ length: 80 }, (_, index) => {
    const gameIds = games.filter((_, rank) => random() < popularity[rank]!).map((game) => game.id);
    return {
      id: `p${index + 1}`,
      gameIds: gameIds.length > 0 ? gameIds : [games[Math.floor(random() * games.length)]!.id],
    };
  });
  return { games, participants };
}

describe('ExhaustiveDrawAlgorithm (TI-4)', () => {
  it('place le plus de participants : celui qui a deux parties laisse sa place à celui qui n’en a qu’une', () => {
    const input = aDrawInput([aGame('A', 1, 1), aGame('B', 1, 1)], { AB: 1, A: 1 });
    for (const output of drawTwentyTimes(input)) {
      expect(output).toEqual(
        expect.arrayContaining([
          { participantId: 'p1', gameId: 'B' },
          { participantId: 'p2', gameId: 'A' },
        ]),
      );
    }
  });

  it('remplit le plus de parties à leur minimum, avant d’équilibrer : 5 joueurs sur 1 à 6 et 4 à 4 donnent 1 + 4', () => {
    const input = aDrawInput([aGame('A', 1, 6), aGame('B', 4, 4)], { AB: 5 });
    for (const output of drawTwentyTimes(input)) {
      expect(countPlayersPerGame(input, output)).toEqual({ A: 1, B: 4 });
    }
  });

  it('met le moins de joueurs dans les parties qui restent sous leur minimum : 4 inscrits sur deux parties de 3 à 6 donnent 4 + 0', () => {
    const input = aDrawInput([aGame('A', 3, 6), aGame('B', 3, 6)], { AB: 4 });
    for (const output of drawTwentyTimes(input)) {
      const playerCounts = Object.values(countPlayersPerGame(input, output));
      expect(playerCounts.sort()).toEqual([0, 4]);
    }
  });

  it('laisse le hasard départager les répartitions ex aequo : les 4 vont tantôt à A, tantôt à B', () => {
    const input = aDrawInput([aGame('A', 3, 6), aGame('B', 3, 6)], { AB: 4 });
    const fullGames = drawTwentyTimes(input).map((output) => output[0]!.gameId);
    expect(new Set(fullGames)).toEqual(new Set(['A', 'B']));
  });

  describe('équilibre les tables, la moins remplie d’abord', () => {
    it.each([
      [
        '6 joueurs sur 2 à 6 et 2 à 3 : 4 + 2',
        [aGame('A', 2, 6), aGame('B', 2, 3)],
        6,
        { A: 4, B: 2 },
      ],
      [
        '7 joueurs sur 2 à 6 et 2 à 3 : 4 + 3, les deux tables aux deux tiers ou plus',
        [aGame('A', 2, 6), aGame('B', 2, 3)],
        7,
        { A: 4, B: 3 },
      ],
      [
        '5 joueurs sur 1 à 3 et 1 à 8 : 2 + 3',
        [aGame('A', 1, 3), aGame('B', 1, 8)],
        5,
        { A: 2, B: 3 },
      ],
    ])('%s', (_, games, playerCount, expected) => {
      const input = aDrawInput(games, { AB: playerCount });
      for (const output of drawTwentyTimes(input)) {
        expect(countPlayersPerGame(input, output)).toEqual(expected);
      }
    });
  });

  it('tire un créneau de 80 inscrits en moins de 50 ms', () => {
    const input = aRealSizeDrawInput();
    const start = performance.now();
    algorithm.computeAssignments(input, createSeededRandom(1));
    expect(performance.now() - start).toBeLessThan(50);
  });
});
