import type { Notification } from '@chimeres/domain';

/**
 * Port d'envoi des notifications d'un geste, appelé par la commande après une sauvegarde réussie
 * (ADR 0010). L'implémentation écrit leur texte et les envoie en arrière-plan : le geste n'attend
 * pas l'envoi.
 */
export interface NotificationSender {
  send(notifications: readonly Notification[]): void;
}
