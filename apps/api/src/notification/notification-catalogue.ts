import { frontOfficeUrls } from '@chimeres/contract';
import {
  buildAssignedText,
  buildCancelledText,
  buildGameMovedText,
  buildGameOversubscribedText,
  buildGameUnscheduledText,
  buildNewGameText,
  buildOwnGameScheduledText,
  buildOwnGameUnscheduledText,
  buildLatecomerText,
  buildUnassignedText,
  buildLeadingText,
  type ChangeText,
} from '@chimeres/design';
import type { NotificationCode, NotificationParams } from '@chimeres/domain';

/**
 * Le texte d'une notification : un titre qui commence par le créneau, un corps qui se suffit à
 * lui-même sur l'écran verrouillé, et l'adresse que le tap ouvre, depuis la racine du front office.
 * `replacement` : les notifications de même `tag` se remplacent sur le téléphone et chez le service
 * push (`Topic`), avec un nouveau son si `renotify` (NO-5) ; sans lui, elles s'empilent.
 */
export type NotificationText = ChangeText & {
  url: string;
  replacement?: { tag: string; renotify: boolean };
};

/** Le scénario d'une notification, tel que le nomment ses textes : son titre et son jeu. */
export type NotifiedScenario = { title: string; system: string };

/** Un code dont les paramètres nomment un scénario reçoit ce scénario ; les autres, rien. */
type Writer<P> = P extends { scenarioId: string }
  ? (params: P, scenario: NotifiedScenario) => NotificationText
  : (params: P) => NotificationText;

/**
 * Les textes des notifications, en français, un par code (ADR 0010), ceux de NO-2. Un code sans
 * texte ne compile pas. Titre et corps viennent de `@chimeres/design`, que l'alerte de changement
 * du front office reprend (NO-5) ; l'API y ajoute l'adresse du tap.
 */
export const notificationCatalogue: {
  [C in NotificationCode]: Writer<NotificationParams[C]>;
} = {
  'game-unscheduled': ({ ranks, withoutGame, reopened }, { title }) => ({
    ...buildGameUnscheduledText(ranks, title, withoutGame, reopened),
    url: frontOfficeUrls.timeSlotGames(ranks[0]!),
  }),
  'own-game-unscheduled': ({ ranks, reopened, backupSignUps }, { title }) => ({
    ...buildOwnGameUnscheduledText(ranks, title, { reopened, backupSignUps }),
    url: frontOfficeUrls.timeSlotGames(ranks[0]!),
  }),
  'game-moved': ({ gameId, fromRanks, toRanks, withoutGame, reopened }, { title }) => ({
    ...buildGameMovedText(fromRanks, toRanks, title, withoutGame, reopened),
    url: frontOfficeUrls.game(gameId),
  }),
  'game-oversubscribed': ({ rank }, { title }) => ({
    ...buildGameOversubscribedText(rank, title),
    url: frontOfficeUrls.timeSlotGames(rank),
    // Un `Topic` tient en 32 caractères base64url.
    replacement: { tag: `oversubscribed-${rank}`, renotify: true },
  }),
  'new-game': ({ gameId, ranks, tableName, reopened, backup }, { title, system }) => ({
    ...buildNewGameText(ranks, { title, system, tableName }, { reopened, backup }),
    url: frontOfficeUrls.game(gameId),
    replacement: { tag: `new-game-${ranks[0]!}`, renotify: false },
  }),
  'own-game-scheduled': ({ ranks, tableName, start, end }, { title }) => ({
    ...buildOwnGameScheduledText(ranks, { title, tableName }, start, end),
    url: frontOfficeUrls.myGamesOnTimeSlot(ranks[0]!),
  }),
  'draw-assigned': ({ gameId, ranks, tableName, gameMasterNickname }, { title }) => ({
    ...buildAssignedText(ranks, { title, tableName, gameMasterNickname }),
    url: frontOfficeUrls.game(gameId),
  }),
  'draw-unassigned': ({ rank, tablesWithSeats, withoutGame }) => ({
    ...buildUnassignedText(rank, tablesWithSeats, withoutGame),
    url: frontOfficeUrls.timeSlotGames(rank),
  }),
  'game-cancelled': ({ ranks, tablesWithSeats }, { title }) => ({
    ...buildCancelledText(ranks, title, tablesWithSeats),
    url: frontOfficeUrls.timeSlotGames(ranks[0]!),
  }),
  'draw-leading': ({ ranks, tableName, playerCount }, { title }) => ({
    ...buildLeadingText(ranks, { title, tableName }, playerCount),
    url: frontOfficeUrls.myGamesOnTimeSlot(ranks[0]!),
  }),
  'latecomer-unassigned': ({ rank, tablesWithSeats }) => ({
    ...buildLatecomerText(rank, tablesWithSeats),
    url: frontOfficeUrls.timeSlotGames(rank),
  }),
};
