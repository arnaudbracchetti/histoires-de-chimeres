import { frontOfficeUrls } from '@chimeres/contract';
import { formatTimeSlotRanks, fr } from '@chimeres/design';
import type { NotificationCode, NotificationParams } from '@chimeres/domain';

/**
 * Le texte d'une notification : un titre qui commence par le créneau, un corps qui se suffit à
 * lui-même sur l'écran verrouillé, et l'adresse que le tap ouvre, depuis la racine du front office.
 */
export type NotificationText = { title: string; body: string; url: string };

type Writer<P> = (params: P, scenarioTitle: string) => NotificationText;

/**
 * Les textes des notifications, en français, un par code (ADR 0010), ceux de NO-2. Un code sans
 * texte ne compile pas. Typographie de docs/design/ton.md : espace insécable devant « : ».
 */
export const notificationCatalogue: {
  [C in NotificationCode]: Writer<NotificationParams[C]>;
} = {
  'game-unscheduled': ({ ranks }, title) => ({
    title: fr`${timeSlotsOf(ranks)} : partie retirée du programme`,
    body: fr`${title} est retirée : ton inscription est supprimée.`,
    url: frontOfficeUrls.timeSlotGames(ranks[0]!),
  }),
  'own-game-unscheduled': ({ ranks }, title) => ({
    title: fr`${timeSlotsOf(ranks)} : partie retirée du programme`,
    body: fr`${title} est retirée : tu peux t'inscrire sur ce créneau.`,
    url: frontOfficeUrls.timeSlotGames(ranks[0]!),
  }),
  'game-moved': ({ gameId, fromRanks, toRanks }, title) => ({
    title: fr`${timeSlotsOf(fromRanks)} : partie déplacée`,
    body: fr`${title} passe ${toRanks.length > 1 ? 'aux' : 'au'} ${formatTimeSlotRanks(toRanks)} : ton inscription est retirée. Réinscris-toi si l'horaire te va.`,
    url: frontOfficeUrls.game(gameId),
  }),
};

/** « Créneau 2 », ou « Créneaux 2 et 3 » pour une partie double (NO-2). */
function timeSlotsOf(ranks: readonly number[]): string {
  const label = formatTimeSlotRanks(ranks);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
