import type {
  FrontOfficeGameDto,
  FrontOfficeScheduleDto,
  FrontOfficeTimeSlotDto,
} from '@chimeres/contract';
import {
  countOf,
  formatCancelledBody,
  formatCapitalizedTimeSlotRanks,
  formatPlayerCount,
  formatSeatsLeft,
  formatTimeRange,
  formatTimeSlotRanks,
  formatUnassignedBody,
  fr,
} from '@chimeres/design';
import type { LedGame } from '../participant-data/participant-data';

/** « Aucun inscrit · 5 places », « 6 inscrits · 4 places » : les places maximum (§5.3). */
export function counterOf(game: FrontOfficeGameDto): string {
  return `${signUpCountOf(game)} · ${countOf(game.seats.max, 'place', 'places')}`;
}

/** « 6 inscrits », ou « Aucun inscrit ». */
export function signUpCountOf({ signUpCount }: FrontOfficeGameDto): string {
  return signUpCount ? countOf(signUpCount, 'inscrit', 'inscrits') : 'Aucun inscrit';
}

/** « 7 inscrits pour 5 places », « aucun inscrit pour 5 places » : dans une phrase. */
export function signUpsForSeatsOf(game: FrontOfficeGameDto): string {
  const signUps = game.signUpCount ? signUpCountOf(game) : 'aucun inscrit';
  return `${signUps} pour ${countOf(game.seats.max, 'place', 'places')}`;
}

/** Les créneaux d'une partie, dans l'ordre de la journée, tels que le programme les donne. */
export function timeSlotsOf(schedule: FrontOfficeScheduleDto, game: FrontOfficeGameDto) {
  return schedule.timeSlots.filter(({ id }) => game.timeSlotIds.includes(id));
}

/**
 * « Créneau 2 · 14 h 00 – 18 h 30 », « Créneaux 3 et 4 · 14 h 00 – 23 h 00 » pour une partie
 * double, de son premier début à sa dernière fin.
 */
export function timeSlotsLabelOf(
  schedule: FrontOfficeScheduleDto,
  game: FrontOfficeGameDto,
): string {
  return timeSlotsLabel(timeSlotsOf(schedule, game));
}

/** « Créneau 2 · 14 h 00 – 18 h 30 », « Créneaux 3 et 4 · 14 h 00 – 23 h 00 » : des créneaux qui se suivent. */
export function timeSlotsLabel(slots: FrontOfficeTimeSlotDto[]): string {
  const range = formatTimeRange(slots[0]!.start, slots.at(-1)!.end);
  return `${formatCapitalizedTimeSlotRanks(slots.map(({ rank }) => rank))} · ${range}`;
}

/** « Créneau 2 », ou « Créneaux 3 et 4 » pour une partie double. */
export function ranksLabelOf(schedule: FrontOfficeScheduleDto, game: FrontOfficeGameDto): string {
  return formatCapitalizedTimeSlotRanks(ranksOf(schedule, game));
}

/** « créneaux 1 et 2 » pour une partie double, `null` sinon : une partie simple est sous son créneau. */
export function doubleGameRanksOf(
  schedule: FrontOfficeScheduleDto,
  game: FrontOfficeGameDto,
): string | null {
  const ranks = ranksOf(schedule, game);
  return ranks.length > 1 ? formatTimeSlotRanks(ranks) : null;
}

/** Les rangs des créneaux d'une partie. */
export function ranksOf(schedule: FrontOfficeScheduleDto, game: FrontOfficeGameDto): number[] {
  return timeSlotsOf(schedule, game).map(({ rank }) => rank);
}

/**
 * Le rappel d'IN-5, quand la seule inscription du créneau est une partie très demandée : dans Mes
 * parties, et sur la ligne du créneau dans l'Accueil.
 */
export function oversubscribedReminderOf(rank: number): string {
  return fr`Ta seule inscription du créneau ${rank} est une partie très demandée : inscris-toi aussi à une autre partie.`;
}

/** « Il reste de la place aux tables Dragon et Licorne », ou que tout est complet (PRD §5.4). */
export function seatsLeftText(gamesWithSeats: FrontOfficeGameDto[]): string {
  return formatSeatsLeft(tableNamesOf(gamesWithSeats));
}

/** « Pas de place pour toi » : où il reste de la place, ou que tout est complet (story 55). */
export function unassignedText(gamesWithSeats: FrontOfficeGameDto[]): string {
  return formatUnassignedBody(tableNamesOf(gamesWithSeats));
}

/** Les tables de ces parties. */
export function tableNamesOf(games: FrontOfficeGameDto[]): string[] {
  return games.map(({ tableName }) => tableName);
}

/** Les parties qui commencent sur ce créneau publié, où il reste de la place. */
export function gamesWithSeatsOn(timeSlotId: string, schedule: FrontOfficeScheduleDto) {
  return schedule.games.filter(
    ({ timeSlotIds, playerCount, seats }) =>
      timeSlotIds[0] === timeSlotId && playerCount !== null && playerCount < seats.max,
  );
}

/** Les joueurs publiés de la partie qu'il mène, ou aucun avant la publication. */
export function playersOf({ outcome }: LedGame): string[] {
  return outcome.kind === 'players' ? outcome.players : [];
}

/** « avec 5 joueurs », ou « sans joueur » : ses joueurs publiés (story 56). */
export function withPlayersOf(led: LedGame): string {
  return formatPlayerCount(playersOf(led).length);
}

/** Les parties du créneau où il reste de la place, quand la partie qu'il mène est annulée. */
export function gamesWithSeatsOf({ outcome }: LedGame): FrontOfficeGameDto[] {
  return outcome.kind === 'cancelled' ? outcome.gamesWithSeats : [];
}

/**
 * « Partie annulée » (TI-6) : la partie n'a pas atteint son minimum, et où il reste de la place,
 * ou que tout est complet.
 */
export function cancelledGameText(led: LedGame): string {
  return formatCancelledBody(led.game.title, tableNamesOf(gamesWithSeatsOf(led)));
}
