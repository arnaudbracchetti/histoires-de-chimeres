import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { DrawStage } from './convention.js';
import type { Day } from './day.js';
import type { Draw } from './draw.js';
import { computeDrawTracking, type DrawTracking } from './draw-tracking.js';
import type { Participant } from './participant.js';
import type { TimeSlotReserveEntry } from './reserve.js';
import { computeSignUpWarnings, type SignUpWarning } from './sign-up-warning.js';
import type { SignUpCollaborators, SignUpFigures, SignUps } from './sign-ups.js';
import type { Table } from './table.js';

/**
 * La capacité d'un créneau : de la somme des places minimum à la somme des places maximum des
 * parties qui y commencent.
 */
export type Capacity = { min: number; max: number };

/**
 * Le suivi d'une partie, sur le créneau où elle commence : ses inscrits actifs (IN-4), combien n'ont
 * pas d'autre inscription active sur le créneau, « très demandée » (inscrits > places maximum,
 * IN-5) et « sous son minimum » (inscrits < places minimum, jamais sur un créneau sans inscription
 * ou fermé), avec leur écart : les inscrits de trop au-delà du maximum, et ceux qui manquent pour
 * le minimum (0 quand elle n'est pas sous son minimum).
 */
export type GameTracking = { gameId: string } & SignUpFigures & {
    oversubscribed: boolean;
    belowMinimum: boolean;
    surplusSignUpCount: number;
    missingSignUpCount: number;
  };

/**
 * Le risque d'un participant du créneau : sans partie (`without-game`) ; ou, quand aucune de ses
 * parties du créneau n'est sûre (inscrits entre ses places minimum et maximum), toutes sont très
 * demandées, il risque de ne pas être placé, sinon il risque de rester sans table.
 */
export type ParticipantRisk = 'without-game' | 'may-not-be-placed' | 'may-be-left-without-table';

/**
 * Un participant du créneau : les parties qui y commencent où son inscription est active (IN-4),
 * dans l'ordre de leur programmation, aucune s'il y est sans partie, et son risque, ou `null`.
 */
export type ParticipantTracking = {
  participantId: string;
  gameIds: string[];
  risk: ParticipantRisk | null;
};

/**
 * Le suivi des inscriptions d'un créneau : son état, sa demande, sa capacité, ses parties, celles
 * qui y commencent, dans l'ordre de leur programmation, ses participants : ceux qui y sont sans
 * partie d'abord, puis ceux qui n'y ont qu'une inscription, puis les autres, chaque groupe dans
 * l'ordre naturel des pseudos, ses
 * avertissements de suivi (aucun sur un créneau sans inscription, ou fermé), sa réserve, vide sur
 * un créneau fermé, et son tirage, `null` tant qu'il n'est pas lancé.
 */
export type TimeSlotTracking = {
  timeSlotId: string;
  state: DrawStage;
  demand: number;
  capacity: Capacity;
  games: GameTracking[];
  participants: ParticipantTracking[];
  warnings: SignUpWarning[];
  reserve: TimeSlotReserveEntry[];
  draw: DrawTracking | null;
};

/** Ce que le suivi lit de la convention, tiré de son état. */
export type SignUpTrackingCollaborators = {
  day: Day;
  signUps: SignUps;
  signUpCollaborators: SignUpCollaborators;
  /** Dans l'ordre naturel de leur pseudo. */
  participants: readonly Participant[];
  /** Dans l'ordre naturel. */
  tables: readonly Table[];
  getDrawStage(timeSlotId: string): DrawStage;
  /** Le tirage du créneau, ou `undefined` tant qu'il n'est pas lancé. */
  findDrawOfTimeSlot(timeSlotId: string): Draw | undefined;
  /** Le participant du MJ, que le tirage d'une partie nomme. */
  findExistingParticipantIdOfGameMaster(gameMasterId: string): string;
  /** La réserve du créneau : voir `computeReserveOfTimeSlot()`. */
  computeReserveOfTimeSlot(timeSlotId: string): TimeSlotReserveEntry[];
};

/**
 * Le suivi de chaque créneau, dans l'ordre de la journée. Les inscriptions inactives n'y entrent pas
 * (IN-4). Une partie double ne compte que sur son premier créneau : sur le second, elle n'entre ni
 * dans la demande ni dans la capacité, ni parmi ses parties. Le catalogue, entier, donne les places
 * des parties.
 */
export function computeSignUpTracking(
  catalogue: ScenarioCatalogue,
  collaborators: SignUpTrackingCollaborators,
): TimeSlotTracking[] {
  const { day, signUps, signUpCollaborators, getDrawStage, computeReserveOfTimeSlot } =
    collaborators;
  return day.timeSlots.map((slot) => {
    const state = getDrawStage(slot.id);
    const draw = collaborators.findDrawOfTimeSlot(slot.id);
    const demand = signUps.countDemandOnTimeSlot(slot.id, signUpCollaborators);
    const games = signUpCollaborators.schedule.listGamesStartingOnTimeSlot(slot.id);
    const seats = games.map((game) => catalogue.findExistingEntryById(game.scenarioId));
    const tracked = games.map((game, index): GameTracking => {
      const { minSeats, maxSeats } = seats[index]!;
      const figures = signUps.computeSignUpFiguresOfGame(game, signUpCollaborators);
      const belowMinimum = isTrackingShortfalls(state, demand) && figures.signUpCount < minSeats;
      return {
        gameId: game.id,
        ...figures,
        oversubscribed: figures.signUpCount > maxSeats,
        belowMinimum,
        surplusSignUpCount: Math.max(figures.signUpCount - maxSeats, 0),
        missingSignUpCount: belowMinimum ? minSeats - figures.signUpCount : 0,
      };
    });
    const capacity = seats.reduce(
      (sum, { minSeats, maxSeats }) => ({ min: sum.min + minSeats, max: sum.max + maxSeats }),
      { min: 0, max: 0 },
    );
    const participants = listParticipantsOfTimeSlot(
      { timeSlotId: slot.id, state, demand, games: tracked },
      collaborators,
    );
    const countParticipantsAtRisk = (risk: ParticipantRisk) =>
      participants.filter((participant) => participant.risk === risk).length;
    return {
      timeSlotId: slot.id,
      state,
      demand,
      capacity,
      games: tracked,
      participants,
      warnings: isTrackingShortfalls(state, demand)
        ? computeSignUpWarnings({
            demand,
            capacity,
            gamesBelowMinimum: tracked.filter((game) => game.belowMinimum).length,
            participantsWithoutGame: countParticipantsAtRisk('without-game'),
            participantsMayNotBePlaced: countParticipantsAtRisk('may-not-be-placed'),
            participantsMayBeLeftWithoutTable: countParticipantsAtRisk('may-be-left-without-table'),
          })
        : [],
      reserve: state === 'sign-ups-open' ? computeReserveOfTimeSlot(slot.id) : [],
      draw: draw ? computeDrawTracking(draw, catalogue, collaborators) : null,
    };
  });
}

/**
 * « Sous son minimum », les risques et les avertissements de suivi ne valent que sur un créneau
 * ouvert qui a des inscriptions : avant, les parties ne paraissent pas menacées dès leur
 * programmation.
 */
function isTrackingShortfalls(state: DrawStage, demand: number): boolean {
  return state === 'sign-ups-open' && demand > 0;
}

/**
 * Les participants du créneau, dans l'ordre de `TimeSlotTracking`, à partir de son état, de sa
 * demande et du suivi de ses parties.
 */
function listParticipantsOfTimeSlot(
  {
    timeSlotId,
    state,
    demand,
    games,
  }: Pick<TimeSlotTracking, 'timeSlotId' | 'state' | 'demand' | 'games'>,
  { signUps, signUpCollaborators, participants }: SignUpTrackingCollaborators,
): ParticipantTracking[] {
  const withoutGame = new Set(
    signUps.listParticipantIdsWithoutGameOnTimeSlot(timeSlotId, signUpCollaborators),
  );
  const gamesByParticipant = new Map<string, GameTracking[]>();
  for (const tracked of games) {
    const game = signUpCollaborators.schedule.findExistingGameById(tracked.gameId);
    for (const participantId of signUps.listActiveParticipantIdsOfGame(game, signUpCollaborators)) {
      gamesByParticipant.set(participantId, [
        ...(gamesByParticipant.get(participantId) ?? []),
        tracked,
      ]);
    }
  }
  const listed = participants.flatMap(({ id }): ParticipantTracking[] => {
    if (withoutGame.has(id)) {
      return [
        {
          participantId: id,
          gameIds: [],
          risk: isTrackingShortfalls(state, demand) ? 'without-game' : null,
        },
      ];
    }
    const own = gamesByParticipant.get(id);
    if (!own) return [];
    return [
      {
        participantId: id,
        gameIds: own.map(({ gameId }) => gameId),
        risk: isTrackingShortfalls(state, demand) ? computeParticipantRisk(own) : null,
      },
    ];
  });
  return [
    ...listed.filter(({ gameIds }) => gameIds.length === 0),
    ...listed.filter(({ gameIds }) => gameIds.length === 1),
    ...listed.filter(({ gameIds }) => gameIds.length > 1),
  ];
}

/**
 * Le risque d'un participant, d'après ses parties du créneau : aucun si l'une est sûre (inscrits
 * entre ses places minimum et maximum). Voir `ParticipantRisk`.
 */
function computeParticipantRisk(games: readonly GameTracking[]): ParticipantRisk | null {
  if (games.some((game) => !game.oversubscribed && !game.belowMinimum)) return null;
  return games.every((game) => game.oversubscribed)
    ? 'may-not-be-placed'
    : 'may-be-left-without-table';
}
