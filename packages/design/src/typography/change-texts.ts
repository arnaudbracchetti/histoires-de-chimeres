import { countOf, formatList, fr } from './french.js';
import { formatTimeRange, formatTimeSlotRanks } from './time.js';

/**
 * Le texte d'un changement pour le participant, le même dans sa notification, écrite par l'API
 * (NO-2), et dans l'alerte de changement du front office, application ouverte (NO-5) : un titre
 * qui commence par le créneau, un corps qui se suffit à lui-même.
 */
export type ChangeText = { title: string; body: string };

/** Une partie, telle que la nomment les textes. */
type NamedGame = { title: string; tableName: string };

/** « Créneau 2 », ou « Créneaux 2 et 3 » pour une partie double : en tête d'un titre (NO-2). */
export function formatCapitalizedTimeSlotRanks(ranks: readonly number[]): string {
  const label = formatTimeSlotRanks(ranks);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** « Il reste de la place aux tables Dragon et Licorne », ou que tout est complet (PRD §5.4). */
export function formatSeatsLeft(tablesWithSeats: readonly string[]): string {
  if (!tablesWithSeats.length) return 'Toutes les parties du créneau sont complètes.';
  const names = formatList(tablesWithSeats);
  return tablesWithSeats.length > 1
    ? `Il reste de la place aux tables ${names}`
    : `Il reste de la place à la table ${names}`;
}

/** « Pas de place pour toi » : où il reste de la place, ou que tout est complet (NO-2). */
export function formatUnassignedBody(tablesWithSeats: readonly string[]): string {
  if (!tablesWithSeats.length) return formatSeatsLeft(tablesWithSeats);
  return fr`Les parties que tu avais choisies sont complètes. ${formatSeatsLeft(tablesWithSeats)} : va voir ${formatGameMasters(tablesWithSeats)}.`;
}

/** « Partie annulée » (TI-6) : elle n'a pas atteint son minimum, et où il reste de la place. */
export function formatCancelledBody(gameTitle: string, tablesWithSeats: readonly string[]): string {
  if (!tablesWithSeats.length)
    return fr`${gameTitle} n'a pas atteint son minimum. ${formatSeatsLeft([])}`;
  return fr`${gameTitle} n'a pas atteint son minimum. ${formatSeatsLeft(tablesWithSeats)} : va voir ${formatGameMasters(tablesWithSeats)}.`;
}

/** « avec 5 joueurs », ou « sans joueur ». */
export function formatPlayerCount(count: number): string {
  return count ? `avec ${countOf(count, 'joueur', 'joueurs')}` : 'sans joueur';
}

/** Ses inscrits : la partie est retirée du programme avant le tirage de son créneau. */
export function buildGameUnscheduledText(ranks: readonly number[], gameTitle: string): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : partie retirée du programme`,
    body: fr`${gameTitle} est retirée : ton inscription est supprimée.`,
  };
}

/** Son MJ : la partie est retirée du programme avant le tirage de son créneau. */
export function buildOwnGameUnscheduledText(
  ranks: readonly number[],
  gameTitle: string,
): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : partie retirée du programme`,
    body: fr`${gameTitle} est retirée : tu peux t'inscrire sur ce créneau.`,
  };
}

/** Ses inscrits : la partie passe à d'autres créneaux avant le tirage (IN-6). */
export function buildGameMovedText(
  fromRanks: readonly number[],
  toRanks: readonly number[],
  gameTitle: string,
): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(fromRanks)} : partie déplacée`,
    body: fr`${gameTitle} passe ${toRanks.length > 1 ? 'aux' : 'au'} ${formatTimeSlotRanks(toRanks)} : ton inscription est retirée. Réinscris-toi si l'horaire te va.`,
  };
}

/** Ses inscrits dont c'est la seule inscription sur le créneau : la partie est très demandée (IN-5). */
export function buildGameOversubscribedText(rank: number, gameTitle: string): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks([rank])} : partie très demandée`,
    body: fr`${gameTitle} est une partie très demandée, et c'est ta seule inscription sur ce créneau. Inscris-toi à d'autres parties pour éviter de te retrouver sans table où jouer.`,
  };
}

/** Son MJ : la partie est programmée, ou déplacée, de `start` à `end` (`HH:MM`). */
export function buildOwnGameScheduledText(
  ranks: readonly number[],
  game: NamedGame,
  start: string,
  end: string,
): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : tu mènes une partie`,
    body: fr`${game.title}, table ${game.tableName}, ${formatTimeRange(start, end)}.`,
  };
}

/** Publication : le participant joue à cette partie. */
export function buildAssignedText(
  ranks: readonly number[],
  game: NamedGame & { gameMasterNickname: string },
): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : table ${game.tableName}`,
    body: fr`Tu joues à ${game.title}, avec ${game.gameMasterNickname}.`,
  };
}

/** Publication : le participant n'est pas placé ; `tablesWithSeats`, où il reste de la place. */
export function buildUnassignedText(rank: number, tablesWithSeats: readonly string[]): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks([rank])} : pas de place pour toi`,
    body: formatUnassignedBody(tablesWithSeats),
  };
}

/** Publication : le MJ mène sa partie avec ses joueurs. */
export function buildLeadingText(
  ranks: readonly number[],
  game: NamedGame,
  playerCount: number,
): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : tu mènes à la table ${game.tableName}`,
    body: fr`${game.title}, ${formatPlayerCount(playerCount)}.`,
  };
}

/** Publication : la partie du MJ est annulée (TI-6) ; `tablesWithSeats`, où il reste de la place. */
export function buildCancelledText(
  ranks: readonly number[],
  gameTitle: string,
  tablesWithSeats: readonly string[],
): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : ta partie est annulée`,
    body: formatCancelledBody(gameTitle, tablesWithSeats),
  };
}

/** « leur MJ », ou « son MJ » pour une seule table. */
function formatGameMasters(tablesWithSeats: readonly string[]): string {
  return tablesWithSeats.length > 1 ? 'leur MJ' : 'son MJ';
}
