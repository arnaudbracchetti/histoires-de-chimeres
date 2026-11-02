import type { DrawGame } from '@chimeres/domain';

/** Une répartition : le nombre de joueurs de chaque partie, dans l'ordre des parties de l'entrée. */
export type Distribution = readonly number[];

/**
 * Les répartitions qui placent `assignedCount` participants, sans dépasser les places de
 * `seatsPerGame`, et que les inscriptions permettent : pour tout ensemble de parties, pas plus de
 * joueurs que de participants inscrits à au moins l'une d'elles (condition de Hall). Ce sont
 * exactement les répartitions où chacun peut être placé sur une partie de ses inscriptions.
 * `gameRanksOf[p]` : les rangs des parties du participant `p`. Rendues une à une, sans les garder.
 */
export function* listFeasibleDistributions(
  gameRanksOf: readonly (readonly number[])[],
  seatsPerGame: readonly number[],
  assignedCount: number,
): Generator<Distribution> {
  const gameCount = seatsPerGame.length;
  // Un ensemble de parties s'écrit en bits : le bit `r` pour la partie de rang `r`. Il en faut un
  // tableau de 2^n cases pour n parties : le calcul vaut pour les quelques tables d'un créneau.
  const gameSetOf = gameRanksOf.map((ranks) => ranks.reduce((set, rank) => set | (1 << rank), 0));
  // Pour chaque ensemble de parties, le nombre de participants inscrits à au moins l'une d'elles.
  const signedUpCount = Array.from(
    { length: 1 << gameCount },
    (_, set) => gameSetOf.filter((ownSet) => (ownSet & set) !== 0).length,
  );
  // Une partie a au plus ses places, et pas plus de joueurs que d'inscrits.
  const maxPlayers = seatsPerGame.map((seats, rank) => Math.min(seats, signedUpCount[1 << rank]!));
  const maxPlayersAfter = maxPlayers.map((_, rank) => sum(maxPlayers.slice(rank + 1)));
  const counts: number[] = seatsPerGame.map(() => 0);

  // Hall, pour les ensembles dont `rank` est la dernière partie : les autres sont déjà vérifiés.
  const isHallConditionMetUpTo = (rank: number): boolean => {
    for (let set = 1 << rank; set < 1 << (rank + 1); set++) {
      let players = 0;
      for (let game = 0; game <= rank; game++) {
        if ((set & (1 << game)) !== 0) players += counts[game]!;
      }
      if (players > signedUpCount[set]!) return false;
    }
    return true;
  };

  // Les joueurs de la partie `rank`, puis, pour chaque nombre possible, ceux des parties suivantes.
  function* distributeFromRank(rank: number, assignedSoFar: number): Generator<Distribution> {
    if (rank === gameCount) {
      yield [...counts];
      return;
    }
    const remaining = assignedCount - assignedSoFar;
    const fewest = Math.max(0, remaining - maxPlayersAfter[rank]!);
    const most = Math.min(maxPlayers[rank]!, remaining);
    for (let players = fewest; players <= most; players++) {
      counts[rank] = players;
      // Plus de joueurs ne rétablirait pas la condition.
      if (!isHallConditionMetUpTo(rank)) break;
      yield* distributeFromRank(rank + 1, assignedSoFar + players);
    }
    counts[rank] = 0;
  }

  yield* distributeFromRank(0, 0);
}

/**
 * Les meilleures répartitions selon les étapes 3 à 5 de TI-4, toutes ex aequo. Chacune a sa clé,
 * comparée terme à terme : la plus grande l'emporte.
 */
export function listBestDistributions(
  games: readonly DrawGame[],
  distributions: Iterable<Distribution>,
): Distribution[] {
  const commonDenominator = games.reduce((lcmSoFar, game) => lcm(lcmSoFar, game.maxSeats), 1);
  let best: Distribution[] = [];
  let bestKey: number[] | null = null;
  for (const distribution of distributions) {
    const key = computeRankingKey(games, distribution, commonDenominator);
    const comparison = bestKey === null ? 1 : compareKeys(key, bestKey);
    if (comparison > 0) {
      best = [distribution];
      bestKey = key;
    } else if (comparison === 0) {
      best.push(distribution);
    }
  }
  return best;
}

/**
 * 3. Le nombre de parties à leur minimum.
 * 4. Moins le nombre de joueurs des parties qui restent sous leur minimum.
 * 5. Les remplissages (joueurs divisés par places maximum), du plus bas au plus haut : la table la
 *    moins remplie d'abord. Ils sont calculés en entiers, ramenés au même dénominateur, le PPCM
 *    des maximums : deux remplissages égaux (4 sur 6, 2 sur 3) le sont exactement.
 */
function computeRankingKey(
  games: readonly DrawGame[],
  distribution: Distribution,
  commonDenominator: number,
): number[] {
  const isAtMinimum = (rank: number) => distribution[rank]! >= games[rank]!.minSeats;
  const atMinimum = games.filter((_, rank) => isAtMinimum(rank)).length;
  const playersUnderMinimum = sum(distribution.filter((_, rank) => !isAtMinimum(rank)));
  const fills = distribution.map(
    (players, rank) => players * (commonDenominator / games[rank]!.maxSeats),
  );
  return [atMinimum, -playersUnderMinimum, ...fills.sort((a, b) => a - b)];
}

function compareKeys(key: readonly number[], other: readonly number[]): number {
  for (const [index, term] of key.entries()) {
    if (term !== other[index]) return term - other[index]!;
  }
  return 0;
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function sum(numbers: readonly number[]): number {
  return numbers.reduce((total, number) => total + number, 0);
}
