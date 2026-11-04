import type { StatusLevel } from './status-level.js';

/** Une partie au-delà de son maximum : ses joueurs et ses places maximum. */
export type GameOverMaximum = { gameId: string; playerCount: number; maxSeats: number };

/**
 * Codes des signaux du tirage d'un créneau, avec leurs paramètres. `contract` déclare la même
 * carte, que l'API traduit en titre et en détail (ADR 0008) ; `application` vérifie à la
 * compilation qu'elles concordent.
 */
export type DrawSignalParams = {
  /** `unassignedCount` participants ne sont pas placés ; `freeSeatCount` places restent libres. */
  'participants-unassigned': { unassignedCount: number; freeSeatCount: number };
  /** `gameCount` parties maintenues n'ont aucun joueur. */
  'games-without-players': { gameCount: number };
  /** `gameCount` parties ont 1 joueur au moins, sous leur minimum. */
  'games-below-minimum': { gameCount: number };
  /** Ces parties ont plus de joueurs que leurs places maximum, dans l'ordre de leur programmation. */
  'games-over-maximum': { games: GameOverMaximum[] };
};

export type DrawSignalCode = keyof DrawSignalParams;

/** Un signal du tirage : un code, son niveau et ses paramètres, sans texte. */
export type DrawSignal = {
  [C in DrawSignalCode]: { code: C; level: StatusLevel; params: DrawSignalParams[C] };
}[DrawSignalCode];

/** Ce que les signaux lisent du suivi du tirage. */
export type DrawSignalFigures = {
  unassignedCount: number;
  freeSeatCount: number;
  gamesWithoutPlayers: number;
  gamesBelowMinimum: number;
  gamesOverMaximum: GameOverMaximum[];
};

/**
 * Les signaux d'un tirage provisoire, les rouges d'abord : `participants-unassigned`,
 * `games-without-players`, puis `games-below-minimum`, `games-over-maximum`.
 */
export function computeDrawSignals(figures: DrawSignalFigures): DrawSignal[] {
  const signals: DrawSignal[] = [];
  if (figures.unassignedCount > 0) {
    signals.push({
      code: 'participants-unassigned',
      level: 'danger',
      params: { unassignedCount: figures.unassignedCount, freeSeatCount: figures.freeSeatCount },
    });
  }
  if (figures.gamesWithoutPlayers > 0) {
    signals.push({
      code: 'games-without-players',
      level: 'danger',
      params: { gameCount: figures.gamesWithoutPlayers },
    });
  }
  if (figures.gamesBelowMinimum > 0) {
    signals.push({
      code: 'games-below-minimum',
      level: 'warning',
      params: { gameCount: figures.gamesBelowMinimum },
    });
  }
  if (figures.gamesOverMaximum.length > 0) {
    signals.push({
      code: 'games-over-maximum',
      level: 'warning',
      params: { games: figures.gamesOverMaximum },
    });
  }
  return signals;
}
