import { buildParticipantRecipients, type Notification } from '../notification.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { Day } from './day.js';
import type { Draw } from './draw.js';
import type { Game } from './game.js';
import type { Participants } from './participants.js';
import type { Schedule } from './schedule.js';
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
};

/**
 * Les notifications de la publication du tirage (TI-7, NO-2) : « table » aux joueurs de chaque
 * partie, « pas de place » aux non placés, avec les tables où il reste de la place, puis « tu
 * mènes » au MJ de chaque partie. Les parties sont celles qui commencent sur le créneau, sans les
 * annulées, dans l'ordre de leur programmation ; la partie double commencée au créneau d'avant n'en
 * est pas. Chacune court jusqu'à la fin du créneau, le second d'une partie double (NO-3). Un
 * créneau sans partie se publie sans notification.
 */
export function buildDrawPublicationNotifications(
  draw: Draw,
  collaborators: DrawPublicationCollaborators,
): Notification[] {
  const { day, date, schedule, tables, participants, catalogue } = collaborators;
  const games = schedule
    .listGamesStartingOnTimeSlot(draw.timeSlotId)
    .filter((game) => !draw.isGameCancelled(game.id));
  if (!games.length) return [];
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

  const unassignedIds = draw.listUnassignedParticipantIds();
  const freeTableIds = new Set(
    games
      .filter(
        (game) =>
          draw.countPlayersOfGame(game.id) <
          catalogue.findExistingEntryById(game.scenarioId).maxSeats,
      )
      .map((game) => game.tableId),
  );
  const unassigned: Notification[] = unassignedIds.length
    ? [
        {
          code: 'draw-unassigned',
          params: {
            rank,
            tablesWithSeats: tables.itemsInNaturalOrder
              .filter((table) => freeTableIds.has(table.id))
              .map((table) => table.name.text),
          },
          recipients: buildParticipantRecipients(unassignedIds),
          deadline: day.computeEndOfTimeSlots(date, [draw.timeSlotId]),
        },
      ]
    : [];

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

  return [...assigned, ...unassigned, ...leading];
}
