import { buildParticipantRecipients, type Notification } from '../notification.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { Day } from './day.js';
import type { Draw } from './draw.js';
import type { Game } from './game.js';
import type { Participants } from './participants.js';
import type { Schedule } from './schedule.js';
import type { SignUpCollaborators, SignUps } from './sign-ups.js';
import type { Table } from './table.js';
import type { UniquelyNamedCollection } from './uniquely-named-collection.js';

/** Ce que les notifications de la publication lisent hors du tirage, tiré de l'état de la convention. */
export type DrawPublicationCollaborators = {
  day: Day;
  /** La date de la convention, `AAAA-MM-JJ`, ou `null` : les notifications n'ont pas d'échéance. */
  date: string | null;
  schedule: Schedule;
  tables: UniquelyNamedCollection<Table>;
  participants: Participants;
  /** Entier : il donne les places maximum des parties. */
  catalogue: ScenarioCatalogue;
  /** Elles donnent les participants sans partie du créneau. */
  signUps: SignUps;
  signUpCollaborators: SignUpCollaborators;
};

/**
 * Les notifications de la publication du tirage provisoire (TI-7, NO-2) : « partie annulée » au MJ
 * de chaque partie annulée, « table » aux joueurs de chaque partie, « pas de place » aux non placés,
 * sauf le MJ d'une partie annulée, déjà prévenu, avec les tables où il reste de la place, en deux
 * notifications quand il le faut : les participants sans partie (`withoutGame`) à part ; puis
 * « tu mènes » au MJ de chaque partie. Le MJ d'une partie annulée qu'un Organisateur a placé reçoit
 * donc « partie annulée », puis « table » (NO-1). Les parties sont celles qui commencent sur le
 * créneau, dans l'ordre de leur programmation ; la partie double commencée au créneau d'avant n'en
 * est pas. Une partie annulée n'a ni joueur, ni place libre, ni « tu mènes ». Chacune court jusqu'à la fin du créneau, le second d'une partie double (NO-3). Un
 * créneau sans partie se publie sans notification.
 */
export function buildDrawPublicationNotifications(
  draw: Draw,
  collaborators: DrawPublicationCollaborators,
): Notification[] {
  const { day, date, schedule, tables, participants, catalogue, signUps, signUpCollaborators } =
    collaborators;
  const starting = schedule.listGamesStartingOnTimeSlot(draw.timeSlotId);
  const cancelledGames = starting.filter((game) => draw.isGameCancelled(game.id));
  const games = starting.filter((game) => !cancelledGames.includes(game));
  if (!games.length && !cancelledGames.length) return [];
  const rank = day.getTimeSlotRank(draw.timeSlotId);
  const listRanks = (game: Game) => game.timeSlotIds.map((slotId) => day.getTimeSlotRank(slotId));
  const findTableName = (tableId: string) => tables.findExistingItemById(tableId).name.text;
  const findGameMaster = (game: Game) => participants.findExistingGameMasterById(game.gameMasterId);
  const computeDeadline = (game: Game) => day.computeEndOfTimeSlots(date, game.timeSlotIds);

  const assigned = games.flatMap((game): Notification[] => {
    const players = draw.listPlayerIdsOfGame(game.id);
    if (!players.length) return [];
    return [
      {
        code: 'draw-assigned',
        params: {
          gameId: game.id,
          scenarioId: game.scenarioId,
          ranks: listRanks(game),
          tableName: findTableName(game.tableId),
          gameMasterNickname: findGameMaster(game).participant.nickname.text,
        },
        recipients: buildParticipantRecipients(players),
        deadline: computeDeadline(game),
      },
    ];
  });

  const tablesWithSeats = draw
    .listTablesWithSeats({ schedule, tables: tables.itemsInNaturalOrder, catalogue })
    .map(({ tableId }) => findTableName(tableId));

  const cancelled = cancelledGames.map((game): Notification => ({
    code: 'game-cancelled',
    params: { scenarioId: game.scenarioId, ranks: listRanks(game), tablesWithSeats },
    recipients: buildParticipantRecipients([findGameMaster(game).participant.id]),
    deadline: computeDeadline(game),
  }));
  const cancelledGameMasterIds = cancelled.flatMap(({ recipients }) => recipients.participantIds);

  const unassignedIds = draw
    .listUnassignedParticipantIds()
    .filter((participantId) => !cancelledGameMasterIds.includes(participantId));
  const withoutGameIds = new Set(
    signUps.listParticipantIdsWithoutGameOnTimeSlot(draw.timeSlotId, signUpCollaborators),
  );
  // « Pas de place » en deux notifications : les inscrits, puis les participants sans partie.
  const buildUnassignedNotifications = (withoutGame: boolean): Notification[] => {
    const recipients = unassignedIds.filter((id) => withoutGameIds.has(id) === withoutGame);
    if (!recipients.length) return [];
    return [
      {
        code: 'draw-unassigned',
        params: { rank, tablesWithSeats, withoutGame },
        recipients: buildParticipantRecipients(recipients),
        deadline: day.computeEndOfTimeSlots(date, [draw.timeSlotId]),
      },
    ];
  };
  const unassigned = [
    ...buildUnassignedNotifications(false),
    ...buildUnassignedNotifications(true),
  ];

  const leading = games.map((game): Notification => ({
    code: 'draw-leading',
    params: {
      scenarioId: game.scenarioId,
      ranks: listRanks(game),
      tableName: findTableName(game.tableId),
      playerCount: draw.countPlayersOfGame(game.id),
    },
    recipients: buildParticipantRecipients([findGameMaster(game).participant.id]),
    deadline: computeDeadline(game),
  }));

  return [...cancelled, ...assigned, ...unassigned, ...leading];
}
