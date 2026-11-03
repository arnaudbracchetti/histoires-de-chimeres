import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { Draw } from './draw.js';
import type { Participant } from './participant.js';
import type { SignUpCollaborators, SignUps } from './sign-ups.js';
import type { Table } from './table.js';

/**
 * Le tirage d'une partie qui commence sur le créneau : ses joueurs, « sous son minimum » (1 joueur
 * au moins, sous ses places minimum), « sans joueur », « au-delà de son maximum », et son écart :
 * les places libres sous son maximum, ou les joueurs de trop au-delà.
 */
export type DrawGameTracking = {
  gameId: string;
  playerCount: number;
  belowMinimum: boolean;
  withoutPlayers: boolean;
  overMaximum: boolean;
  freeSeatCount: number;
  surplusPlayerCount: number;
};

/**
 * Une affectation du tirage : la partie, ou `null` ; déplacé à la main ; les parties du créneau où
 * l'inscription du participant est active (IN-4), dans l'ordre de son inscription ; et s'il joue à
 * une partie qui n'est pas de ses inscriptions.
 */
export type AssignmentTracking = {
  participantId: string;
  gameId: string | null;
  movedByHand: boolean;
  signedUpGameIds: string[];
  playsWithoutSignUp: boolean;
};

/** Une table où il reste de la place, et combien. */
export type TableWithSeats = { tableId: string; freeSeatCount: number };

/**
 * Le tirage d'un créneau lancé : publié ou provisoire, ses chiffres, ses parties, celles qui
 * commencent sur le créneau, dans l'ordre de leur programmation, les tables où il reste de la place,
 * dans l'ordre naturel des tables, et ses affectations, dans l'ordre naturel des pseudos.
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
};

/** Ce que le suivi du tirage lit de la convention, tiré de son état. */
export type DrawTrackingCollaborators = {
  signUps: SignUps;
  signUpCollaborators: SignUpCollaborators;
  /** Dans l'ordre naturel de leur pseudo. */
  participants: readonly Participant[];
  /** Dans l'ordre naturel. */
  tables: readonly Table[];
};

/**
 * Le suivi du tirage d'un créneau lancé. Le catalogue, entier, donne les places actuelles des
 * parties (PR-4).
 */
export function computeDrawTracking(
  draw: Draw,
  catalogue: ScenarioCatalogue,
  { signUps, signUpCollaborators, participants, tables }: DrawTrackingCollaborators,
): DrawTracking {
  const starting = signUpCollaborators.schedule.listGamesStartingOnTimeSlot(draw.timeSlotId);
  // Chaque partie avec sa table et si elle est à son minimum, que le suivi ne garde pas.
  const measured = starting.map((game) => {
    const { minSeats, maxSeats } = catalogue.findExistingEntryById(game.scenarioId);
    const playerCount = draw.assignments.filter(({ gameId }) => gameId === game.id).length;
    const tracking: DrawGameTracking = {
      gameId: game.id,
      playerCount,
      belowMinimum: playerCount > 0 && playerCount < minSeats,
      withoutPlayers: playerCount === 0,
      overMaximum: playerCount > maxSeats,
      freeSeatCount: Math.max(maxSeats - playerCount, 0),
      surplusPlayerCount: Math.max(playerCount - maxSeats, 0),
    };
    return { tableId: game.tableId, atMinimum: playerCount >= minSeats, tracking };
  });
  const games = measured.map(({ tracking }) => tracking);
  const startingIds = new Set(starting.map((game) => game.id));
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
      },
    ];
  });
  const assignedCount = draw.assignments.filter(({ gameId }) => gameId !== null).length;
  const freeSeatsByTable = new Map(
    measured.map(({ tableId, tracking }) => [tableId, tracking.freeSeatCount]),
  );
  return {
    published: draw.published,
    participantCount: draw.assignments.length,
    assignedCount,
    unassignedCount: draw.assignments.length - assignedCount,
    gameCount: games.length,
    gamesAtMinimumCount: measured.filter(({ atMinimum }) => atMinimum).length,
    freeSeatCount: games.reduce((sum, game) => sum + game.freeSeatCount, 0),
    tablesWithSeats: tables.flatMap((table): TableWithSeats[] => {
      const freeSeatCount = freeSeatsByTable.get(table.id) ?? 0;
      return freeSeatCount > 0 ? [{ tableId: table.id, freeSeatCount }] : [];
    }),
    games,
    assignments,
  };
}
