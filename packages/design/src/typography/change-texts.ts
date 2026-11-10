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

/** « Partie annulée » (TI-7) : elle n'a pas atteint son minimum, et où il reste de la place. */
function formatCancelledBody(gameTitle: string, tablesWithSeats: readonly string[]): string {
  if (!tablesWithSeats.length)
    return fr`${gameTitle} n'a pas atteint son minimum. ${formatSeatsLeft([])}`;
  return fr`${gameTitle} n'a pas atteint son minimum. ${formatSeatsLeft(tablesWithSeats)} : va voir ${formatGameMasters(tablesWithSeats)}.`;
}

/**
 * Le corps, suivi de « Les inscriptions du créneau sont rouvertes. » si le geste a effacé le tirage
 * provisoire du créneau (TI-6, NO-2).
 */
function appendReopeningSentence(body: string, reopened: boolean): string {
  return reopened ? `${body} Les inscriptions du créneau sont rouvertes.` : body;
}

/** « avec 5 joueurs », ou « sans joueur ». */
export function formatPlayerCount(count: number): string {
  return count ? `avec ${countOf(count, 'joueur', 'joueurs')}` : 'sans joueur';
}

/**
 * Ses inscrits : la partie est retirée du programme avant la publication de son créneau.
 * `withoutGame` : c'était sa dernière inscription sur son premier créneau, il reste dans son tirage
 * (IN-6). `reopened` : le geste a effacé le tirage provisoire du créneau.
 */
export function buildGameUnscheduledText(
  ranks: readonly number[],
  gameTitle: string,
  withoutGame: boolean,
  reopened: boolean,
): ChangeText {
  const removed = fr`${gameTitle} est retirée : ton inscription est supprimée.`;
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : partie retirée du programme`,
    body: appendReopeningSentence(
      withoutGame
        ? fr`${removed} Tu restes dans le tirage du ${formatTimeSlotRanks([ranks[0]!])} : inscris-toi à une autre partie pour avoir une table.`
        : removed,
      reopened,
    ),
  };
}

/**
 * Son MJ : la partie est retirée du programme avant la publication de son créneau. `reopened` : le
 * geste a effacé le tirage provisoire du créneau. `backupSignUps` : ses inscriptions de secours
 * sur ce créneau comptent désormais (IN-4).
 */
export function buildOwnGameUnscheduledText(
  ranks: readonly number[],
  gameTitle: string,
  { reopened, backupSignUps }: { reopened: boolean; backupSignUps: boolean },
): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : partie retirée du programme`,
    body: appendReopeningSentence(
      backupSignUps
        ? fr`${gameTitle} est retirée : tes inscriptions de secours sur ce créneau comptent désormais.`
        : fr`${gameTitle} est retirée : tu peux t'inscrire sur ce créneau.`,
      reopened,
    ),
  };
}

/**
 * Ses inscrits : la partie passe à d'autres créneaux avant la publication (IN-6). `withoutGame` :
 * c'était sa dernière inscription sur son ancien premier créneau, il reste dans son tirage.
 * `reopened` : le geste a effacé le tirage provisoire de l'ancien ou du nouveau créneau.
 */
export function buildGameMovedText(
  fromRanks: readonly number[],
  toRanks: readonly number[],
  gameTitle: string,
  withoutGame: boolean,
  reopened: boolean,
): ChangeText {
  const moved = fr`${gameTitle} passe ${toRanks.length > 1 ? 'aux' : 'au'} ${formatTimeSlotRanks(toRanks)} : ton inscription est retirée. Réinscris-toi si l'horaire te va.`;
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(fromRanks)} : partie déplacée`,
    body: appendReopeningSentence(
      withoutGame
        ? fr`${moved} Tu restes dans le tirage du ${formatTimeSlotRanks([fromRanks[0]!])} : inscris-toi à une autre partie pour y avoir une table.`
        : moved,
      reopened,
    ),
  };
}

/** Ses inscrits dont c'est la seule inscription sur le créneau : la partie est très demandée (IN-5). */
export function buildGameOversubscribedText(rank: number, gameTitle: string): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks([rank])} : partie très demandée`,
    body: fr`${gameTitle} est une partie très demandée, et c'est ta seule inscription sur ce créneau. Inscris-toi à d'autres parties pour éviter de te retrouver sans table où jouer.`,
  };
}

/**
 * Ceux qui peuvent s'y inscrire : une partie est programmée, ou déplacée, sur un créneau pas encore
 * publié. `system` : le jeu de son scénario. `reopened` : le geste a effacé le tirage provisoire du
 * créneau. `backup` : un MJ qui mène sur le créneau, qui peut s'y inscrire en secours (IN-4).
 */
export function buildNewGameText(
  ranks: readonly number[],
  game: NamedGame & { system: string },
  { reopened, backup }: { reopened: boolean; backup: boolean },
): ChangeText {
  const invitation = backup
    ? fr`Tu peux t'y inscrire en secours, au cas où ta partie serait annulée.`
    : fr`Tu peux t'y inscrire.`;
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : nouvelle partie`,
    body: appendReopeningSentence(
      fr`${game.title} · ${game.system}, table ${game.tableName}. ${invitation}`,
      reopened,
    ),
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

/**
 * Publication : le participant n'est pas placé ; `tablesWithSeats`, où il reste de la place.
 * `withoutGame` : il était sans partie sur le créneau, il n'y avait plus d'inscription.
 */
export function buildUnassignedText(
  rank: number,
  tablesWithSeats: readonly string[],
  withoutGame: boolean,
): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks([rank])} : pas de place pour toi`,
    body: withoutGame
      ? formatWithoutGameUnassignedBody(tablesWithSeats)
      : formatUnassignedBody(tablesWithSeats),
  };
}

/** « Pas de place pour toi », au participant sans partie : il n'avait plus d'inscription. */
function formatWithoutGameUnassignedBody(tablesWithSeats: readonly string[]): string {
  return formatSeatsLeftAfter(fr`Tu n'avais plus d'inscription sur ce créneau.`, tablesWithSeats);
}

/**
 * La phrase d'en-tête, puis les tables où il reste de la place et leurs MJ à aller voir ; sans
 * table, que toutes les parties du créneau sont complètes.
 */
function formatSeatsLeftAfter(header: string, tablesWithSeats: readonly string[]): string {
  if (!tablesWithSeats.length) return fr`${header} ${formatSeatsLeft(tablesWithSeats)}`;
  return fr`${header} ${formatSeatsLeft(tablesWithSeats)} : va voir ${formatGameMasters(tablesWithSeats)}.`;
}

/**
 * Retardataire ajouté au tirage publié, non placé (ID-14) : le tirage est fait ;
 * `tablesWithSeats`, où il reste de la place.
 */
export function buildLatecomerText(rank: number, tablesWithSeats: readonly string[]): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks([rank])} : pas de place pour toi`,
    body: formatSeatsLeftAfter(fr`Le tirage de ce créneau est déjà fait.`, tablesWithSeats),
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

/** Publication : la partie du MJ est annulée, puis déprogrammée (TI-7) ; `tablesWithSeats`, où il reste de la place. */
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

/**
 * L'alerte du MJ dont la partie annulée quitte le programme à la publication (NO-5, TI-7) : le titre
 * de la notification, sans les tables où il reste de la place, que le téléphone ne calcule pas.
 */
export function buildCancelledAlertText(ranks: readonly number[], gameTitle: string): ChangeText {
  return {
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : ta partie est annulée`,
    body: fr`${gameTitle} n'a pas atteint son minimum.`,
  };
}

/** « leur MJ », ou « son MJ » pour une seule table. */
function formatGameMasters(tablesWithSeats: readonly string[]): string {
  return tablesWithSeats.length > 1 ? 'leur MJ' : 'son MJ';
}
