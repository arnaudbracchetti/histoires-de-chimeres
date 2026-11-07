import { buildParticipantRecipients, type Notification } from '../notification.js';
import type { TimeSlotState } from './convention.js';
import type { Day } from './day.js';
import type { Game } from './game.js';
import type { Participants } from './participants.js';
import type { Schedule } from './schedule.js';
import type { SignUpCollaborators, SignUps } from './sign-ups.js';
import type { Table } from './table.js';
import type { UniquelyNamedCollection } from './uniquely-named-collection.js';

/**
 * Ce que le changement du Programme lit hors des deux Programmes. Le geste ne change ni la journée,
 * ni la date, ni les tables, ni les participants : une seule valeur suffit. Les inscriptions d'avant,
 * avec ce qu'elles lisent dans le Programme d'avant, donnent les inscrits ; celles d'après, qui
 * devient sans partie.
 */
export type ScheduleChangeCollaborators = {
  day: Day;
  /** `AAAA-MM-JJ`, ou `null` : les notifications n'ont alors pas d'échéance (NO-3). */
  date: string | null;
  tables: UniquelyNamedCollection<Table>;
  participants: Participants;
  previousSignUps: SignUps;
  previousSignUpCollaborators: SignUpCollaborators;
  /** Les inscriptions d'après le geste, avec ce qu'elles lisent dans le Programme d'après. */
  nextSignUps: SignUps;
  nextSignUpCollaborators: SignUpCollaborators;
  /** L'état de chaque créneau avant le geste : un tirage provisoire qu'il efface rouvre le créneau. */
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
   * Les premiers créneaux dont le geste change les parties (TI-6) : celui d'une partie déprogrammée,
   * l'ancien et le nouveau d'une partie passée sur d'autres créneaux, celui d'une nouvelle partie.
   * Un changement de table, ou un échange sur un même créneau, n'en fait pas partie. Sans doublon.
   */
  listTimeSlotIdsWithChangedGames(): string[] {
    return [
      ...new Set([
        ...this.listUnscheduledGames().map(getFirstTimeSlotId),
        ...this.listGamesMovedToOtherTimeSlots().map(({ previous }) =>
          getFirstTimeSlotId(previous),
        ),
        ...this.listGamesOnNewTimeSlots().map(getFirstTimeSlotId),
      ]),
    ];
  }

  /**
   * « Partie retirée du programme » aux inscrits actifs de chaque partie déprogrammée, et aux MJ qui
   * s'y sont inscrits en secours (IN-4, IN-6), jusqu'à la fin de son dernier créneau (NO-3) : une
   * pour ceux qui deviennent sans partie sur son premier créneau (`withoutGame`), une pour les
   * autres. Rien sans inscrit.
   */
  private buildGameUnscheduledNotifications(
    collaborators: ScheduleChangeCollaborators,
  ): Notification[] {
    const { day, date, previousSignUps, previousSignUpCollaborators } = collaborators;
    return this.listUnscheduledGames().flatMap((game) =>
      splitByWithoutGame(
        game,
        previousSignUps.listActiveOrBackupParticipantIdsOfGame(game, previousSignUpCollaborators),
        collaborators,
      ).map(({ participantIds, withoutGame }): Notification => ({
        code: 'game-unscheduled',
        params: {
          scenarioId: game.scenarioId,
          ranks: day.getTimeSlotRanks(game.timeSlotIds),
          withoutGame,
          reopened: isTimeSlotDrawingBeforeChange(game, collaborators),
        },
        recipients: buildParticipantRecipients(participantIds),
        deadline: day.computeEndOfTimeSlots(date, game.timeSlotIds),
      })),
    );
  }

  /**
   * « Partie retirée du programme » au MJ de chaque partie déprogrammée, jusqu'à la fin de son
   * dernier créneau (NO-3). Son inscription à sa propre partie n'est pas active (IN-4) : il ne
   * reçoit que celle-ci (NO-1). `backupSignUps` : des inscriptions de secours deviennent actives.
   */
  private buildOwnGameUnscheduledNotifications(
    collaborators: ScheduleChangeCollaborators,
  ): Notification[] {
    const { day, date, participants } = collaborators;
    return this.listUnscheduledGames().map((game): Notification => {
      const gameMasterParticipantId = getGameMasterParticipantId(game, participants);
      return {
        code: 'own-game-unscheduled',
        params: {
          scenarioId: game.scenarioId,
          ranks: day.getTimeSlotRanks(game.timeSlotIds),
          reopened: isTimeSlotDrawingBeforeChange(game, collaborators),
          backupSignUps: hasBackupSignUpsBecomingActive(gameMasterParticipantId, collaborators),
        },
        recipients: buildParticipantRecipients([gameMasterParticipantId]),
        deadline: day.computeEndOfTimeSlots(date, game.timeSlotIds),
      };
    });
  }

  /**
   * « Partie déplacée » aux inscrits actifs de chaque partie passée sur d'autres créneaux, et aux MJ
   * qui s'y sont inscrits en secours (IN-4, IN-6), jusqu'à la fin du plus tardif de ses anciens et
   * nouveaux créneaux (NO-3) : une pour ceux qui deviennent sans partie sur son ancien premier
   * créneau (`withoutGame`), une pour les autres. Rien sans inscrit.
   */
  private buildGameMovedNotifications(collaborators: ScheduleChangeCollaborators): Notification[] {
    const { day, date, previousSignUps, previousSignUpCollaborators } = collaborators;
    return this.listGamesMovedToOtherTimeSlots().flatMap(({ previous, next }) =>
      splitByWithoutGame(
        previous,
        previousSignUps.listActiveOrBackupParticipantIdsOfGame(
          previous,
          previousSignUpCollaborators,
        ),
        collaborators,
      ).map(({ participantIds, withoutGame }): Notification => ({
        code: 'game-moved',
        params: {
          gameId: previous.id,
          scenarioId: previous.scenarioId,
          fromRanks: day.getTimeSlotRanks(previous.timeSlotIds),
          toRanks: day.getTimeSlotRanks(next.timeSlotIds),
          withoutGame,
          reopened:
            isTimeSlotDrawingBeforeChange(previous, collaborators) ||
            isTimeSlotDrawingBeforeChange(next, collaborators),
        },
        recipients: buildParticipantRecipients(participantIds),
        deadline: day.computeEndOfTimeSlots(date, [...previous.timeSlotIds, ...next.timeSlotIds]),
      })),
    );
  }

  /**
   * « Nouvelle partie » pour chaque partie arrivée sur ses créneaux, avant la publication de son
   * créneau : une à tous, sauf aux MJ qui mènent sur l'un de ses créneaux et à
   * `moreSpecificRecipients` (NO-1) ; une autre à ces MJ, qui peuvent s'y inscrire en secours
   * (`backup`, IN-4), sans elle s'il n'y en a aucun. Les joueurs d'une partie double publiée qui
   * occupe le créneau en seront écartés quand le tirage existera. Elle court jusqu'à la fin du
   * dernier créneau de sa partie (NO-3).
   */
  private buildNewGameNotifications(
    moreSpecificRecipients: readonly string[],
    collaborators: ScheduleChangeCollaborators,
  ): Notification[] {
    const { day, date, tables, participants, getTimeSlotState } = collaborators;
    return this.listGamesOnNewTimeSlots()
      .filter((game) => getTimeSlotState(game.timeSlotIds[0]!) !== 'published')
      .flatMap((game): Notification[] => {
        const gameMastersOnTimeSlots = this.listParticipantIdsLeadingOnTimeSlots(
          game.timeSlotIds,
          participants,
        );
        const backupRecipients = gameMastersOnTimeSlots.filter(
          (id) => !moreSpecificRecipients.includes(id),
        );
        const buildNewGameParams = (backup: boolean) => ({
          gameId: game.id,
          scenarioId: game.scenarioId,
          ranks: day.getTimeSlotRanks(game.timeSlotIds),
          tableName: getTableName(game, tables),
          reopened: isTimeSlotDrawingBeforeChange(game, collaborators),
          backup,
        });
        const deadline = day.computeEndOfTimeSlots(date, game.timeSlotIds);
        return [
          {
            code: 'new-game',
            params: buildNewGameParams(false),
            recipients: {
              kind: 'everyone-except',
              participantIds: [...new Set([...gameMastersOnTimeSlots, ...moreSpecificRecipients])],
            },
            deadline,
          },
          ...(backupRecipients.length
            ? [
                {
                  code: 'new-game' as const,
                  params: buildNewGameParams(true),
                  recipients: buildParticipantRecipients(backupRecipients),
                  deadline,
                },
              ]
            : []),
        ];
      });
  }

  /**
   * « Tu mènes une partie » au MJ de chaque partie arrivée sur ses créneaux, jusqu'à la fin de son
   * dernier créneau (NO-3).
   */
  private buildOwnGameScheduledNotifications({
    day,
    date,
    tables,
    participants,
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
      recipients: buildParticipantRecipients([getGameMasterParticipantId(game, participants)]),
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
    participants: Participants,
  ): string[] {
    return participants.gameMasters
      .filter((gameMaster) =>
        timeSlotIds.some((slotId) =>
          this.next.isGameMasterLeadingOnTimeSlot(gameMaster.id, slotId),
        ),
      )
      .map((gameMaster) => gameMaster.participant.id);
  }
}

/**
 * Les inscrits d'une partie qui perd ses inscriptions, en deux groupes : ceux qui restent avec une
 * autre inscription, puis ceux qui deviennent sans partie sur son premier créneau, d'après les
 * inscriptions d'après. Un groupe vide n'en est pas un.
 */
function splitByWithoutGame(
  game: Game,
  signedUp: readonly string[],
  { nextSignUps, nextSignUpCollaborators }: ScheduleChangeCollaborators,
): { participantIds: string[]; withoutGame: boolean }[] {
  const isWithoutGame = (participantId: string) =>
    nextSignUps.isParticipantWithoutGameOnTimeSlot(
      participantId,
      game.timeSlotIds[0]!,
      nextSignUpCollaborators,
    );
  return [
    { participantIds: signedUp.filter((id) => !isWithoutGame(id)), withoutGame: false },
    { participantIds: signedUp.filter(isWithoutGame), withoutGame: true },
  ].filter(({ participantIds }) => participantIds.length);
}

/** Le créneau de la partie, son premier (TI-3). */
function getFirstTimeSlotId(game: Game): string {
  return game.timeSlotIds[0]!;
}

/** Le créneau de la partie était en tirage provisoire : le geste en efface le tirage (TI-6). */
function isTimeSlotDrawingBeforeChange(
  game: Game,
  { getTimeSlotState }: ScheduleChangeCollaborators,
): boolean {
  return getTimeSlotState(getFirstTimeSlotId(game)) === 'drawing';
}

/** Le participant du MJ de la partie (ADR 0012). */
function getGameMasterParticipantId(game: Game, participants: Participants): string {
  return participants.findExistingGameMasterById(game.gameMasterId).participant.id;
}

/** Le nom de la table de la partie. */
function getTableName(game: Game, tables: UniquelyNamedCollection<Table>): string {
  return tables.findExistingItemById(game.tableId).name.text;
}

/**
 * Le geste rend actives des inscriptions de secours du MJ : de secours avant, actives après (IN-4).
 * L'alerte de changement du front office suit la même définition.
 */
function hasBackupSignUpsBecomingActive(
  participantId: string,
  {
    previousSignUps,
    previousSignUpCollaborators,
    nextSignUps,
    nextSignUpCollaborators,
  }: ScheduleChangeCollaborators,
): boolean {
  const activeAfter = nextSignUps.listActiveGameIdsOfParticipant(
    participantId,
    nextSignUpCollaborators,
  );
  return previousSignUps
    .listBackupGameIdsOfParticipant(participantId, previousSignUpCollaborators)
    .some((gameId) => activeAfter.includes(gameId));
}
