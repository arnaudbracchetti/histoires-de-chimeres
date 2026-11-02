import type { DrawGame, DrawInput, RandomSource } from '@chimeres/domain';

/** Une partie de `minSeats` à `maxSeats` places. Son identifiant est une lettre. */
export function aGame(id: string, minSeats: number, maxSeats: number): DrawGame {
  return { id, minSeats, maxSeats };
}

/**
 * Un créneau : ses parties, et le nombre de participants de chaque groupe d'inscriptions
 * identiques. `{ A: 5, AB: 3, '': 1 }` : 5 inscrits à A seule, 3 à A et B, 1 sans partie. Les
 * participants sont numérotés p1, p2… dans l'ordre des groupes.
 */
export function aDrawInput(games: DrawGame[], groups: Record<string, number>): DrawInput {
  const gameIdSets = Object.entries(groups).flatMap(([letters, count]) =>
    Array.from({ length: count }, () => [...letters]),
  );
  return {
    games,
    participants: gameIdSets.map((gameIds, index) => ({ id: `p${index + 1}`, gameIds })),
  };
}

/**
 * Un créneau au hasard : jusqu'à 5 parties de tailles variées, jusqu'à 25 participants, chacun
 * inscrit à chaque partie avec une chance sur trois (aucune possible).
 */
export function aRandomDrawInput(random: RandomSource): DrawInput {
  const pickIntegerUpTo = (max: number) => Math.floor(random() * (max + 1));
  const games = Array.from({ length: pickIntegerUpTo(5) }, (_, index) => {
    const minSeats = 1 + pickIntegerUpTo(3);
    return aGame('ABCDE'[index]!, minSeats, minSeats + pickIntegerUpTo(5));
  });
  const participants = Array.from({ length: pickIntegerUpTo(25) }, (_, index) => ({
    id: `p${index + 1}`,
    gameIds: games.filter(() => random() < 1 / 3).map((game) => game.id),
  }));
  return { games, participants };
}
