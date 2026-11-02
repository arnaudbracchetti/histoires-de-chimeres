/**
 * Affecte les participants, dans l'ordre reçu, à au plus `seatsPerGame[g]` joueurs de chaque
 * partie `g`, et en affecte le plus possible (couplage par chemins augmentants) : un participant
 * affecté le reste, mais peut glisser vers une autre de ses parties pour faire de la place au
 * suivant. `gameRanksOf[p]` : les rangs des parties du participant `p`. Rend le rang de la partie
 * de chaque participant, ou `null` s'il n'est pas placé.
 */
export function computeAssignedGameRanks(
  gameRanksOf: readonly (readonly number[])[],
  seatsPerGame: readonly number[],
): (number | null)[] {
  const assignedRanks: (number | null)[] = gameRanksOf.map(() => null);
  const playersOf: number[][] = seatsPerGame.map(() => []);

  const tryToAssign = (participant: number, visitedGames: Set<number>): boolean => {
    for (const game of gameRanksOf[participant]!) {
      if (visitedGames.has(game)) continue;
      visitedGames.add(game);
      const players = playersOf[game]!;
      if (players.length < seatsPerGame[game]!) {
        players.push(participant);
        assignedRanks[participant] = game;
        return true;
      }
      for (const [position, player] of players.entries()) {
        if (tryToAssign(player, visitedGames)) {
          players[position] = participant;
          assignedRanks[participant] = game;
          return true;
        }
      }
    }
    return false;
  };

  gameRanksOf.forEach((_, participant) => tryToAssign(participant, new Set()));
  return assignedRanks;
}
