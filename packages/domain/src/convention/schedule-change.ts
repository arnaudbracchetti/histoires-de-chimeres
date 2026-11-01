import { buildParticipantRecipients, type Notification } from '../notification.js';
import type { TimeSlotState } from './convention.js';
import type { Day } from './day.js';
import type { Game } from './game.js';
import type { GameMaster } from './game-master.js';
import type { Schedule } from './schedule.js';
import type { SignUpCollaborators, SignUps } from './sign-ups.js';
import type { Table } from './table.js';
import type { UniquelyNamedCollection } from './uniquely-named-collection.js';

/**
 * Ce que le changement du Programme lit hors des deux Programmes. Le geste ne change ni la journée,
 * ni la date, ni les tables, ni les MJ : une seule valeur suffit. Les inscriptions sont celles
 * d'avant, avec ce qu'elles lisent dans le Programme d'avant : le geste efface celles qu'il retire.
 */
export type ScheduleChangeCollaborators = {
  day: Day;
  /** `AAAA-MM-JJ`, ou `null` : les notifications n'ont alors pas d'échéance (NO-3). */
  date: string | null;
  tables: UniquelyNamedCollection<Table>;
  gameMasters: UniquelyNamedCollection<GameMaster>;
  previousSignUps: SignUps;
  previousSignUpCollaborators: SignUpCollaborators;
  getTimeSlotState(timeSlotId: string): TimeSlotState;
};

/**
 * Changement du Programme : l'écart entre le Programme d'avant et celui d'après un geste, dont il
 * tire les notifications (NO-1 à NO-3). Une partie disparue, passée sur d'autres créneaux ou
 * nouvelle a les siennes ; une partie restée sur les mêmes créneaux, à une autre table ou échangée
 * sur son créneau, n'en a aucune (NO-4). Immuable : les deux Programmes sont des références fixes.
 */
export class ScheduleChange {
  constructor(
    private readonly previous: Schedule,
    private readonly next: Schedule,
  ) {}

  /**
   * Les notifications du changement, dans cet ordre : « partie retirée du programme » à ses
   * inscrits, puis à son MJ ; « partie déplacée » ; « nouvelle partie » ; « tu mènes une partie ».
   * Dans chaque groupe, les parties suivent l'ordre du Programme. Une personne ne reçoit que la plus
   * précise (NO-1) : « nouvelle partie » écarte les destinataires de toutes les autres. Deux parties
   * échangées entre deux créneaux envoient à un inscrit des deux une « partie déplacée » par partie.
   */
  buildNotifications(collaborators: ScheduleChangeCollaborators): Notification[] {
    const beforeNewGames = [
      ...this.buildGameUnscheduledNotifications(collaborators),
      ...this.buildOwnGameUnscheduledNotifications(collaborators),
      ...this.buildGameMovedNotifications(collaborators),
    ];
    const ownGamesScheduled = this.buildOwnGameScheduledNotifications(collaborators);
    const moreSpecificRecipients = [...beforeNewGames, ...ownGamesScheduled].flatMap(
      ({ recipients }) => recipients.participantIds,
    );
    return [
      ...beforeNewGames,
      ...this.buildNewGameNotifications(moreSpecificRecipients, collaborators),
      ...ownGamesScheduled,
    ];
  }

  /**
   * « Partie retirée du programme » aux inscrits actifs de chaque partie déprogrammée (IN-4, IN-6),
   * jusqu'à la fin de son dernier créneau (NO-3). Rien sans inscrit.
   */
  private buildGameUnscheduledNotifications({
    day,
    date,
    previousSignUps,
    previousSignUpCollaborators,
  }: ScheduleChangeCollaborators): Notification[] {
    return this.listUnscheduledGames().flatMap((game): Notification[] => {
      const signedUp = previousSignUps.listActiveParticipantIdsOfGame(
        game,
        previousSignUpCollaborators,
      );
      if (!signedUp.length) return [];
      return [
        {
          code: 'game-unscheduled',
          params: { scenarioId: game.scenarioId, ranks: day.getTimeSlotRanks(game.timeSlotIds) },
          recipients: buildParticipantRecipients(signedUp),
          deadline: day.computeEndOfTimeSlots(date, game.timeSlotIds),
        },
      ];
    });
  }

  /**
   * « Partie retirée du programme » au MJ de chaque partie déprogrammée, jusqu'à la fin de son
   * dernier créneau (NO-3). Son inscription à sa propre partie n'est pas active (IN-4) : il ne
   * reçoit que celle-ci (NO-1).
   */
  private buildOwnGameUnscheduledNotifications({
    day,
    date,
    gameMasters,
  }: ScheduleChangeCollaborators): Notification[] {
    return this.listUnscheduledGames().map((game): Notification => ({
      code: 'own-game-unscheduled',
      params: { scenarioId: game.scenarioId, ranks: day.getTimeSlotRanks(game.timeSlotIds) },
      recipients: buildParticipantRecipients([getGameMasterParticipantId(game, gameMasters)]),
      deadline: day.computeEndOfTimeSlots(date, game.timeSlotIds),
    }));
  }

  /**
   * « Partie déplacée » aux inscrits actifs de chaque partie passée sur d'autres créneaux (IN-4,
   * IN-6), jusqu'à la fin du plus tardif de ses anciens et nouveaux créneaux (NO-3). Rien sans
   * inscrit.
   */
  private buildGameMovedNotifications({
    day,
    date,
    previousSignUps,
    previousSignUpCollaborators,
  }: ScheduleChangeCollaborators): Notification[] {
    return this.listGamesMovedToOtherTimeSlots().flatMap(({ previous, next }): Notification[] => {
      const signedUp = previousSignUps.listActiveParticipantIdsOfGame(
        previous,
        previousSignUpCollaborators,
      );
      if (!signedUp.length) return [];
      return [
        {
          code: 'game-moved',
          params: {
            gameId: previous.id,
            scenarioId: previous.scenarioId,
            fromRanks: day.getTimeSlotRanks(previous.timeSlotIds),
            toRanks: day.getTimeSlotRanks(next.timeSlotIds),
          },
          recipients: buildParticipantRecipients(signedUp),
          deadline: day.computeEndOfTimeSlots(date, [...previous.timeSlotIds, ...next.timeSlotIds]),
        },
      ];
    });
  }

  /**
   * « Nouvelle partie » pour chaque partie arrivée sur ses créneaux, avant la publication de son
   * créneau, à tous ceux qui peuvent s'y inscrire. En sont écartés les MJ qui mènent sur l'un de
   * ses créneaux (IN-4), et `moreSpecificRecipients` (NO-1). Les joueurs d'une partie double
   * publiée qui occupe le créneau le seront aussi, quand le tirage existera. Elle court jusqu'à la
   * fin du dernier créneau de sa partie (NO-3).
   */
  private buildNewGameNotifications(
    moreSpecificRecipients: readonly string[],
    { day, date, tables, gameMasters, getTimeSlotState }: ScheduleChangeCollaborators,
  ): Notification[] {
    return this.listGamesOnNewTimeSlots()
      .filter((game) => getTimeSlotState(game.timeSlotIds[0]!) !== 'published')
      .map((game): Notification => ({
        code: 'new-game',
        params: {
          gameId: game.id,
          scenarioId: game.scenarioId,
          ranks: day.getTimeSlotRanks(game.timeSlotIds),
          tableName: getTableName(game, tables),
        },
        recipients: {
          kind: 'everyone-except',
          participantIds: [
            ...new Set([
              ...this.listParticipantIdsLeadingOnTimeSlots(game.timeSlotIds, gameMasters),
              ...moreSpecificRecipients,
            ]),
          ],
        },
        deadline: day.computeEndOfTimeSlots(date, game.timeSlotIds),
      }));
  }

  /**
   * « Tu mènes une partie » au MJ de chaque partie arrivée sur ses créneaux, jusqu'à la fin de son
   * dernier créneau (NO-3).
   */
  private buildOwnGameScheduledNotifications({
    day,
    date,
    tables,
    gameMasters,
  }: ScheduleChangeCollaborators): Notification[] {
    return this.listGamesOnNewTimeSlots().map((game): Notification => ({
      code: 'own-game-scheduled',
      params: {
        scenarioId: game.scenarioId,
        ranks: day.getTimeSlotRanks(game.timeSlotIds),
        tableName: getTableName(game, tables),
        start: day.findExistingTimeSlotById(game.timeSlotIds[0]!).start.toString(),
        end: day.findExistingTimeSlotById(game.timeSlotIds.at(-1)!).end.toString(),
      },
      recipients: buildParticipantRecipients([getGameMasterParticipantId(game, gameMasters)]),
      deadline: day.computeEndOfTimeSlots(date, game.timeSlotIds),
    }));
  }

  /** Les parties du Programme d'avant qui n'y sont plus. */
  private listUnscheduledGames(): Game[] {
    return this.previous.games.filter((game) => !this.next.findGameById(game.id));
  }

  /** Les parties restées au Programme, mais sur d'autres créneaux : telles qu'avant, et après. */
  private listGamesMovedToOtherTimeSlots(): { previous: Game; next: Game }[] {
    return this.previous.games.flatMap((previous) => {
      const next = this.next.findGameById(previous.id);
      return next && !next.isOnSameTimeSlotsAs(previous) ? [{ previous, next }] : [];
    });
  }

  /**
   * Les parties du Programme d'après qui n'étaient pas sur ces créneaux : nouvelles, ou passées sur
   * d'autres créneaux.
   */
  private listGamesOnNewTimeSlots(): Game[] {
    return this.next.games.filter((game) => !this.previous.hasGameOnSameTimeSlots(game));
  }

  /**
   * Les participants des MJ qui mènent, dans le Programme d'après, sur l'un de ces créneaux, dans
   * l'ordre naturel de leur pseudo.
   */
  private listParticipantIdsLeadingOnTimeSlots(
    timeSlotIds: readonly string[],
    gameMasters: UniquelyNamedCollection<GameMaster>,
  ): string[] {
    return gameMasters.itemsInNaturalOrder
      .filter((gameMaster) =>
        timeSlotIds.some((slotId) =>
          this.next.isGameMasterLeadingOnTimeSlot(gameMaster.id, slotId),
        ),
      )
      .map((gameMaster) => gameMaster.participant.id);
  }
}

/** Le participant du MJ de la partie (ADR 0012). */
function getGameMasterParticipantId(
  game: Game,
  gameMasters: UniquelyNamedCollection<GameMaster>,
): string {
  return gameMasters.findExistingItemById(game.gameMasterId).participant.id;
}

/** Le nom de la table de la partie. */
function getTableName(game: Game, tables: UniquelyNamedCollection<Table>): string {
  return tables.findExistingItemById(game.tableId).name.text;
}
