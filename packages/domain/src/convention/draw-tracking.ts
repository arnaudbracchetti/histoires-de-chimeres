import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { Draw, TableWithSeats } from './draw.js';
import { computeDrawSignals, type DrawSignal } from './draw-signal.js';
import type { Participant } from './participant.js';
import type { SignUpCollaborators, SignUps } from './sign-ups.js';
import type { Table } from './table.js';

/**
 * Le tirage d'une partie qui commence sur le créneau : annulée (TI-6), ses joueurs, « sous son
 * minimum » (1 joueur au moins, sous ses places minimum), « sans joueur », « au-delà de son
 * maximum », et son écart : les places libres sous son maximum, ou les joueurs de trop au-delà. Une
 * partie annulée n'a ni joueur, ni drapeau, ni place libre. « Annulable » : non annulée, avec
 * moins de joueurs que son minimum, aucun compris. Enfin, les parties du créneau où son MJ est
 * inscrit, actives ou non (IN-4), dans l'ordre de son inscription.
 */
export type DrawGameTracking = {
  gameId: string;
  cancelled: boolean;
  playerCount: number;
  belowMinimum: boolean;
  withoutPlayers: boolean;
  overMaximum: boolean;
  freeSeatCount: number;
  surplusPlayerCount: number;
  cancellable: boolean;
  gameMasterSignedUpGameIds: string[];
};

/**
 * Une affectation du tirage : la partie, ou `null` ; déplacé à la main ; les parties du créneau où
 * l'inscription du participant est active (IN-4), dans l'ordre de son inscription ; s'il joue à
 * une partie qui n'est pas de ses inscriptions ; s'il est sans partie : enregistré comme tel sur
 * le créneau, ou MJ d'une partie annulée du tirage sans inscription active à une partie maintenue
 * du créneau ; et s'il est le MJ d'une partie annulée, dont les inscriptions de secours sont
 * devenues actives (TI-6, IN-4).
 */
export type AssignmentTracking = {
  participantId: string;
  gameId: string | null;
  movedByHand: boolean;
  signedUpGameIds: string[];
  playsWithoutSignUp: boolean;
  withoutGame: boolean;
  gameMasterOfCancelledGame: boolean;
};

/**
 * Le tirage d'un créneau lancé : publié ou provisoire, ses chiffres, ses parties, celles qui
 * commencent sur le créneau, dans l'ordre de leur programmation, les tables où il reste de la place,
 * dans l'ordre naturel des tables, ses affectations, dans l'ordre naturel des pseudos, et ses
 * signaux, aucun sur un tirage publié.
 */
export type DrawTracking = {
  published: boolean;
  participantCount: number;
  assignedCount: number;
  unassignedCount: number;
  gameCount: number;
  gamesAtMinimumCount: number;
  freeSeatCount: number;
  tablesWithSeats: TableWithSeats[];
  games: DrawGameTracking[];
  assignments: AssignmentTracking[];
  signals: DrawSignal[];
};

/** Ce que le suivi du tirage lit de la convention, tiré de son état. */
export type DrawTrackingCollaborators = {
  signUps: SignUps;
  signUpCollaborators: SignUpCollaborators;
  /** Dans l'ordre naturel de leur pseudo. */
  participants: readonly Participant[];
  /** Dans l'ordre naturel. */
  tables: readonly Table[];
  findExistingParticipantIdOfGameMaster(gameMasterId: string): string;
};

/**
 * Le suivi du tirage d'un créneau lancé. Le catalogue, entier, donne les places actuelles des
 * parties (PR-4).
 */
export function computeDrawTracking(
  draw: Draw,
  catalogue: ScenarioCatalogue,
  collaborators: DrawTrackingCollaborators,
): DrawTracking {
  const { signUps, signUpCollaborators, participants, tables } = collaborators;
  const starting = signUpCollaborators.schedule.listGamesStartingOnTimeSlot(draw.timeSlotId);
  const startingIds = new Set(starting.map((game) => game.id));
  // Chaque partie avec sa table et si elle est à son minimum, que le suivi ne garde pas.
  const measured = starting.map((game) => {
    const { minSeats, maxSeats } = catalogue.findExistingEntryById(game.scenarioId);
    const cancelled = draw.isGameCancelled(game.id);
    const playerCount = draw.countPlayersOfGame(game.id);
    const gameMasterParticipantId = collaborators.findExistingParticipantIdOfGameMaster(
      game.gameMasterId,
    );
    const tracking: DrawGameTracking = {
      gameId: game.id,
      cancelled,
      playerCount,
      belowMinimum: !cancelled && playerCount > 0 && playerCount < minSeats,
      withoutPlayers: !cancelled && playerCount === 0,
      overMaximum: !cancelled && playerCount > maxSeats,
      freeSeatCount: cancelled ? 0 : Math.max(maxSeats - playerCount, 0),
      surplusPlayerCount: Math.max(playerCount - maxSeats, 0),
      cancellable: !cancelled && draw.hasGameBelowMinimum(game.id, minSeats),
      gameMasterSignedUpGameIds: signUps.signUps
        .filter(
          ({ participantId, gameId }) =>
            participantId === gameMasterParticipantId && startingIds.has(gameId),
        )
        .map(({ gameId }) => gameId),
    };
    return {
      tableId: game.tableId,
      atMinimum: !cancelled && playerCount >= minSeats,
      maxSeats,
      tracking,
    };
  });
  const games = measured.map(({ tracking }) => tracking);
  const recordedWithoutGame = new Set(
    signUps.listParticipantIdsWithoutGameOnTimeSlot(draw.timeSlotId, signUpCollaborators),
  );
  const cancelledGameMasterIds = new Set(
    starting
      .filter((game) => draw.isGameCancelled(game.id))
      .map((game) => collaborators.findExistingParticipantIdOfGameMaster(game.gameMasterId)),
  );
  const assignmentOf = new Map(
    draw.assignments.map((assignment) => [assignment.participantId, assignment]),
  );
  const assignments = participants.flatMap(({ id }): AssignmentTracking[] => {
    const assignment = assignmentOf.get(id);
    if (!assignment) return [];
    const signedUpGameIds = signUps
      .listActiveGameIdsOfParticipant(id, signUpCollaborators)
      .filter((gameId) => startingIds.has(gameId));
    return [
      {
        participantId: id,
        gameId: assignment.gameId,
        movedByHand: assignment.movedByHand,
        signedUpGameIds,
        playsWithoutSignUp:
          assignment.gameId !== null && !signedUpGameIds.includes(assignment.gameId),
        withoutGame:
          recordedWithoutGame.has(id) ||
          (cancelledGameMasterIds.has(id) &&
            signedUpGameIds.every((gameId) => draw.isGameCancelled(gameId))),
        gameMasterOfCancelledGame: cancelledGameMasterIds.has(id),
      },
    ];
  });
  const assignedCount = draw.assignments.filter(({ gameId }) => gameId !== null).length;
  const unassignedCount = draw.assignments.length - assignedCount;
  const freeSeatCount = games.reduce((sum, game) => sum + game.freeSeatCount, 0);
  return {
    published: draw.published,
    participantCount: draw.assignments.length,
    assignedCount,
    unassignedCount,
    gameCount: games.filter(({ cancelled }) => !cancelled).length,
    gamesAtMinimumCount: measured.filter(({ atMinimum }) => atMinimum).length,
    freeSeatCount,
    tablesWithSeats: draw.listTablesWithSeats({
      schedule: signUpCollaborators.schedule,
      tables,
      catalogue,
    }),
    games,
    assignments,
    signals: draw.published
      ? []
      : computeDrawSignals({
          unassignedCount,
          freeSeatCount,
          gamesWithoutPlayers: games.filter(({ withoutPlayers }) => withoutPlayers).length,
          gamesBelowMinimum: games.filter(({ belowMinimum }) => belowMinimum).length,
          gamesOverMaximum: measured
            .filter(({ tracking }) => tracking.overMaximum)
            .map(({ maxSeats, tracking: { gameId, playerCount } }) => ({
              gameId,
              playerCount,
              maxSeats,
            })),
        }),
  };
}
