import type { LocalMoment } from './convention/local-moment.js';

/**
 * Codes de notification du domaine, avec leurs paramètres (ADR 0010). L'API seule les traduit en
 * texte. `scenarioId` : le scénario de la partie, qui donne son titre ; `ranks` : les rangs de ses
 * créneaux, deux pour une partie double.
 */
export type NotificationParams = {
  /** Aux inscrits d'une partie déprogrammée : leur inscription est supprimée (IN-6). */
  'game-unscheduled': { scenarioId: string; ranks: number[] };
  /** Au MJ d'une partie déprogrammée : il peut s'inscrire sur ce créneau. */
  'own-game-unscheduled': { scenarioId: string; ranks: number[] };
  /**
   * Aux inscrits d'une partie passée à d'autres créneaux : leur inscription est retirée (IN-6).
   * `fromRanks` : ses anciens créneaux ; `toRanks` : les nouveaux.
   */
  'game-moved': { gameId: string; scenarioId: string; fromRanks: number[]; toRanks: number[] };
  /**
   * Aux inscrits d'une partie passée au-dessus de ses places maximum, dont c'est la seule
   * inscription sur le créneau (IN-5). `rank` : le rang de son premier créneau.
   */
  'game-oversubscribed': { scenarioId: string; rank: number };
  /**
   * À tous ceux qui peuvent s'inscrire sur les créneaux d'une partie programmée ou déplacée, avant
   * leur publication. `tableName` : le nom de sa table.
   */
  'new-game': { gameId: string; scenarioId: string; ranks: number[]; tableName: string };
  /**
   * Au MJ d'une partie programmée, ou déplacée sur d'autres créneaux. `start` et `end` (`HH:MM`) :
   * le début de son premier créneau et la fin du dernier.
   */
  'own-game-scheduled': {
    scenarioId: string;
    ranks: number[];
    tableName: string;
    start: string;
    end: string;
  };
};

export type NotificationCode = keyof NotificationParams;

/** Les destinataires : des participants, par leur identifiant, ou tout le monde sauf eux. */
export type NotificationRecipients = {
  kind: 'participants' | 'everyone-except';
  participantIds: string[];
};

/**
 * Notification produite par un geste du domaine : un code, des paramètres, ses destinataires et son
 * échéance, sans texte. Passé l'échéance, elle n'est plus livrée (NO-3) ; `null` : aucune, tant
 * que la convention n'a pas de date.
 */
export type Notification = {
  [C in NotificationCode]: {
    code: C;
    params: NotificationParams[C];
    recipients: NotificationRecipients;
    deadline: LocalMoment | null;
  };
}[NotificationCode];
