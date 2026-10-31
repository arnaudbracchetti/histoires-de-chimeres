import { frontOfficeUrls } from '@chimeres/contract';
import { formatTimeSlotRanks, fr } from '@chimeres/design';
import type { NotificationCode, NotificationParams } from '@chimeres/domain';

/**
 * Le texte d'une notification : un titre qui commence par le créneau, un corps qui se suffit à
 * lui-même sur l'écran verrouillé, et l'adresse que le tap ouvre, depuis la racine du front office.
 * `replacement` : les notifications de même `tag` se remplacent sur le téléphone et chez le service
 * push (`Topic`), avec un nouveau son si `renotify` (NO-5) ; sans lui, elles s'empilent.
 */
export type NotificationText = {
  title: string;
  body: string;
  url: string;
  replacement?: { tag: string; renotify: boolean };
};

type Writer<P> = (params: P, scenarioTitle: string) => NotificationText;

/**
 * Les textes des notifications, en français, un par code (ADR 0010), ceux de NO-2. Un code sans
 * texte ne compile pas. Typographie de docs/design/ton.md : espace insécable devant « : ».
 */
export const notificationCatalogue: {
  [C in NotificationCode]: Writer<NotificationParams[C]>;
} = {
  'game-unscheduled': ({ ranks }, title) => ({
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : partie retirée du programme`,
    body: fr`${title} est retirée : ton inscription est supprimée.`,
    url: frontOfficeUrls.timeSlotGames(ranks[0]!),
  }),
  'own-game-unscheduled': ({ ranks }, title) => ({
    title: fr`${formatCapitalizedTimeSlotRanks(ranks)} : partie retirée du programme`,
    body: fr`${title} est retirée : tu peux t'inscrire sur ce créneau.`,
    url: frontOfficeUrls.timeSlotGames(ranks[0]!),
  }),
  'game-moved': ({ gameId, fromRanks, toRanks }, title) => ({
    title: fr`${formatCapitalizedTimeSlotRanks(fromRanks)} : partie déplacée`,
    body: fr`${title} passe ${toRanks.length > 1 ? 'aux' : 'au'} ${formatTimeSlotRanks(toRanks)} : ton inscription est retirée. Réinscris-toi si l'horaire te va.`,
    url: frontOfficeUrls.game(gameId),
  }),
  'game-oversubscribed': ({ rank }, title) => ({
    title: fr`${formatCapitalizedTimeSlotRanks([rank])} : partie très demandée`,
    body: fr`${title} est une partie très demandée, et c'est ta seule inscription sur ce créneau. Inscris-toi à d'autres parties pour éviter de te retrouver sans table où jouer.`,
    url: frontOfficeUrls.timeSlotGames(rank),
    // Un `Topic` tient en 32 caractères base64url.
    replacement: { tag: `oversubscribed-${rank}`, renotify: true },
  }),
};

/** « Créneau 2 », ou « Créneaux 2 et 3 » pour une partie double (NO-2). */
function formatCapitalizedTimeSlotRanks(ranks: readonly number[]): string {
  const label = formatTimeSlotRanks(ranks);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
