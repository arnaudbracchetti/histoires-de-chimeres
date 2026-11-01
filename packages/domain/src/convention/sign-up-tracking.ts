import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { TimeSlotState } from './convention.js';
import type { Day } from './day.js';
import type { SignUpCollaborators, SignUpFigures, SignUps } from './sign-ups.js';

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
 * Le suivi des inscriptions d'un créneau : son état, sa demande, sa capacité, et ses parties, celles
 * qui y commencent, dans l'ordre de leur programmation.
 */
export type TimeSlotTracking = {
  timeSlotId: string;
  state: TimeSlotState;
  demand: number;
  capacity: Capacity;
  games: GameTracking[];
};

/** Ce que le suivi lit de la convention, tiré de son état. */
export type SignUpTrackingCollaborators = {
  day: Day;
  signUps: SignUps;
  signUpCollaborators: SignUpCollaborators;
  getTimeSlotState(timeSlotId: string): TimeSlotState;
};

/**
 * Le suivi de chaque créneau, dans l'ordre de la journée. Les inscriptions inactives n'y entrent pas
 * (IN-4). Une partie double ne compte que sur son premier créneau : sur le second, elle n'entre ni
 * dans la demande ni dans la capacité, ni parmi ses parties. Le catalogue, entier, donne les places
 * des parties.
 */
export function computeSignUpTracking(
  catalogue: ScenarioCatalogue,
  { day, signUps, signUpCollaborators, getTimeSlotState }: SignUpTrackingCollaborators,
): TimeSlotTracking[] {
  return day.timeSlots.map((slot) => {
    const state = getTimeSlotState(slot.id);
    const demand = signUps.countDemandOnTimeSlot(slot.id, signUpCollaborators);
    const games = signUpCollaborators.schedule.listGamesStartingOnTimeSlot(slot.id);
    const seats = games.map((game) => catalogue.findExistingEntryById(game.scenarioId));
    return {
      timeSlotId: slot.id,
      state,
      demand,
      capacity: seats.reduce(
        (capacity, { minSeats, maxSeats }) => ({
          min: capacity.min + minSeats,
          max: capacity.max + maxSeats,
        }),
        { min: 0, max: 0 },
      ),
      games: games.map((game, index) => {
        const { minSeats, maxSeats } = seats[index]!;
        const figures = signUps.computeSignUpFiguresOfGame(game, signUpCollaborators);
        const belowMinimum =
          state === 'sign-ups-open' && demand > 0 && figures.signUpCount < minSeats;
        return {
          gameId: game.id,
          ...figures,
          oversubscribed: figures.signUpCount > maxSeats,
          belowMinimum,
          surplusSignUpCount: Math.max(figures.signUpCount - maxSeats, 0),
          missingSignUpCount: belowMinimum ? minSeats - figures.signUpCount : 0,
        };
      }),
    };
  });
}
