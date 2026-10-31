import { frontOfficeUrls } from '@chimeres/contract';
import {
  buildGameMovedText,
  buildGameOversubscribedText,
  buildGameUnscheduledText,
  buildOwnGameUnscheduledText,
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

type Writer<P> = (params: P, scenarioTitle: string) => NotificationText;

/**
 * Les textes des notifications, en français, un par code (ADR 0010), ceux de NO-2. Un code sans
 * texte ne compile pas. Titre et corps viennent de `@chimeres/design`, que l'alerte de changement
 * du front office reprend (NO-5) ; l'API y ajoute l'adresse du tap.
 */
export const notificationCatalogue: {
  [C in NotificationCode]: Writer<NotificationParams[C]>;
} = {
  'game-unscheduled': ({ ranks }, title) => ({
    ...buildGameUnscheduledText(ranks, title),
    url: frontOfficeUrls.timeSlotGames(ranks[0]!),
  }),
  'own-game-unscheduled': ({ ranks }, title) => ({
    ...buildOwnGameUnscheduledText(ranks, title),
    url: frontOfficeUrls.timeSlotGames(ranks[0]!),
  }),
  'game-moved': ({ gameId, fromRanks, toRanks }, title) => ({
    ...buildGameMovedText(fromRanks, toRanks, title),
    url: frontOfficeUrls.game(gameId),
  }),
  'game-oversubscribed': ({ rank }, title) => ({
    ...buildGameOversubscribedText(rank, title),
    url: frontOfficeUrls.timeSlotGames(rank),
    // Un `Topic` tient en 32 caractères base64url.
    replacement: { tag: `oversubscribed-${rank}`, renotify: true },
  }),
};
