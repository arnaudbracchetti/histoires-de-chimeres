/** Paramètre d'une adresse du front office : le rang du créneau montré (`/programme?creneau=2`). */
export const TIME_SLOT_PARAM = 'creneau';

/** Les chemins du front office, sans `/` du début, que lit son routeur. */
export const frontOfficePaths = {
  home: '',
  schedule: 'programme',
  myGames: 'mes-parties',
  /** La fiche d'une partie. */
  game: 'parties/:gameId',
} as const;

/**
 * Les adresses du front office, depuis sa racine, que le catalogue des notifications de l'API donne
 * au tap (ADR 0010).
 */
export const frontOfficeUrls = {
  home: (): string => `/${frontOfficePaths.home}`,
  /** Les parties d'un créneau, dans le programme. */
  timeSlotGames: (rank: number): string =>
    `/${frontOfficePaths.schedule}?${TIME_SLOT_PARAM}=${rank}`,
  /** Mes parties, sur un créneau. */
  myGamesOnTimeSlot: (rank: number): string =>
    `/${frontOfficePaths.myGames}?${TIME_SLOT_PARAM}=${rank}`,
  game: (gameId: string): string =>
    `/${frontOfficePaths.game.replace(':gameId', encodeURIComponent(gameId))}`,
};
