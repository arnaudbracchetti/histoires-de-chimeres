import type { DrawAlgorithm, DrawInput, DrawOutput, RandomSource } from '@chimeres/domain';
import { listBestDistributions, listFeasibleDistributions } from './distributions.js';
import { computeAssignedGameRanks } from './matching.js';
import { shuffle } from './shuffle.js';

/**
 * Le premier algorithme de tirage (#110). Il suit les priorités de TI-4, dans l'ordre :
 * 1. jamais au-dessus du maximum d'une partie, et seulement sur une partie où l'on est inscrit ;
 * 2. placer le plus de participants ;
 * 3. à égalité, le plus de parties à leur minimum ;
 * 4. à égalité, le moins de joueurs dans les parties qui restent sous leur minimum ;
 * 5. à égalité, les tables les plus équilibrées, la moins remplie d'abord ;
 * 6. le hasard, pour le reste.
 * Il examine toutes les répartitions (le nombre de joueurs de chaque partie) : il convient aux
 * quelques parties d'un créneau, une par table.
 */
export class ExhaustiveDrawAlgorithm implements DrawAlgorithm {
  computeAssignments(input: DrawInput, random: RandomSource): DrawOutput {
    const { games } = input;
    // L'ordre mélangé décide seul qui est placé : les participants aux mêmes inscriptions ont les
    // mêmes chances, quel que soit leur rang dans l'entrée.
    const participants = shuffle(input.participants, random);
    const gameRanksOf = participants.map(({ gameIds }) =>
      games.flatMap((game, rank) => (gameIds.includes(game.id) ? [rank] : [])),
    );
    const maxSeats = games.map((game) => game.maxSeats);

    const assignedCount = countAssigned(computeAssignedGameRanks(gameRanksOf, maxSeats));
    const feasible = listFeasibleDistributions(gameRanksOf, maxSeats, assignedCount);
    const best = listBestDistributions(games, feasible);
    const chosen = best[Math.floor(random() * best.length)]!;
    const assignedRanks = computeAssignedGameRanks(gameRanksOf, chosen);

    const gameIdOf = new Map(
      participants.map(({ id }, index) => {
        const rank = assignedRanks[index]!;
        return [id, rank === null ? null : games[rank]!.id];
      }),
    );
    return input.participants.map(({ id }) => ({ participantId: id, gameId: gameIdOf.get(id)! }));
  }
}

function countAssigned(gameRanks: readonly (number | null)[]): number {
  return gameRanks.filter((rank) => rank !== null).length;
}
