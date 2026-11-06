import type { LocalMoment } from './convention/local-moment.js';

/**
 * Codes de notification du domaine, avec leurs paramètres (ADR 0010). L'API seule les traduit en
 * texte. `scenarioId` : le scénario de la partie, qui donne son titre ; `ranks` : les rangs de ses
 * créneaux, deux pour une partie double.
 */
export type NotificationParams = {
  /**
   * Aux inscrits d'une partie déprogrammée : leur inscription est supprimée (IN-6). `withoutGame` :
   * ils deviennent sans partie sur son premier créneau. `reopened` : le geste a effacé le tirage
   * provisoire de ce créneau, dont les inscriptions rouvrent (TI-6) ; de même pour les codes qui
   * suivent.
   */
  'game-unscheduled': {
    scenarioId: string;
    ranks: number[];
    withoutGame: boolean;
    reopened: boolean;
  };
  /** Au MJ d'une partie déprogrammée : il peut s'inscrire sur ce créneau. */
  'own-game-unscheduled': { scenarioId: string; ranks: number[]; reopened: boolean };
  /**
   * Aux inscrits d'une partie passée à d'autres créneaux : leur inscription est retirée (IN-6).
   * `fromRanks` : ses anciens créneaux ; `toRanks` : les nouveaux. `withoutGame` : ils deviennent
   * sans partie sur son ancien premier créneau. `reopened` : l'ancien ou le nouveau premier
   * créneau était en tirage provisoire.
   */
  'game-moved': {
    gameId: string;
    scenarioId: string;
    fromRanks: number[];
    toRanks: number[];
    withoutGame: boolean;
    reopened: boolean;
  };
  /**
   * Aux inscrits d'une partie passée au-dessus de ses places maximum, dont c'est la seule
   * inscription sur le créneau (IN-5). `rank` : le rang de son premier créneau.
   */
  'game-oversubscribed': { scenarioId: string; rank: number };
  /**
   * À tous ceux qui peuvent s'inscrire sur les créneaux d'une partie programmée ou déplacée, avant
   * leur publication. `tableName` : le nom de sa table.
   */
  'new-game': {
    gameId: string;
    scenarioId: string;
    ranks: number[];
    tableName: string;
    reopened: boolean;
  };
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
  /**
   * Publication (TI-7) : aux joueurs d'une partie. `tableName` : le nom de sa table ;
   * `gameMasterNickname` : le pseudo de son MJ.
   */
  'draw-assigned': {
    gameId: string;
    scenarioId: string;
    ranks: number[];
    tableName: string;
    gameMasterNickname: string;
  };
  /**
   * Publication (TI-7) : aux non placés du créneau de rang `rank`. `tablesWithSeats` : les noms des
   * tables où il reste de la place, dans l'ordre naturel.
   */
  'draw-unassigned': { rank: number; tablesWithSeats: string[] };
  /**
   * Publication (TI-7) : au MJ d'une partie annulée, que la publication déprogramme.
   * `tablesWithSeats` : comme pour `draw-unassigned`.
   */
  'game-cancelled': { scenarioId: string; ranks: number[]; tablesWithSeats: string[] };
  /** Publication (TI-7) : au MJ d'une partie, qu'il mène avec `playerCount` joueurs. */
  'draw-leading': { scenarioId: string; ranks: number[]; tableName: string; playerCount: number };
};

export type NotificationCode = keyof NotificationParams;

/** Les destinataires : des participants, par leur identifiant, ou tout le monde sauf eux. */
export type NotificationRecipients = {
  kind: 'participants' | 'everyone-except';
  participantIds: string[];
};

/** Des destinataires désignés par leur identifiant de participant. */
export function buildParticipantRecipients(participantIds: string[]): NotificationRecipients {
  return { kind: 'participants', participantIds };
}

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
