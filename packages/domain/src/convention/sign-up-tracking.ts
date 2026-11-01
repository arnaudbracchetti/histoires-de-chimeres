import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { TimeSlotState } from './convention.js';
import type { Day } from './day.js';
import type { SignUpCollaborators, SignUps } from './sign-ups.js';

/**
 * La capacité d'un créneau : de la somme des places minimum à la somme des places maximum des
 * parties qui y commencent.
 */
export type Capacity = { min: number; max: number };

/** Le suivi des inscriptions d'un créneau : son état, sa demande et sa capacité. */
export type TimeSlotTracking = {
  timeSlotId: string;
  state: TimeSlotState;
  demand: number;
  capacity: Capacity;
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
 * dans la demande ni dans la capacité. Le catalogue, entier, donne les places des parties.
 */
export function computeSignUpTracking(
  catalogue: ScenarioCatalogue,
  { day, signUps, signUpCollaborators, getTimeSlotState }: SignUpTrackingCollaborators,
): TimeSlotTracking[] {
  return day.timeSlots.map((slot) => ({
    timeSlotId: slot.id,
    state: getTimeSlotState(slot.id),
    demand: signUps.countDemandOnTimeSlot(slot.id, signUpCollaborators),
    capacity: signUpCollaborators.schedule.listGamesStartingOnTimeSlot(slot.id).reduce(
      (capacity, game) => {
        const { minSeats, maxSeats } = catalogue.findExistingEntryById(game.scenarioId);
        return { min: capacity.min + minSeats, max: capacity.max + maxSeats };
      },
      { min: 0, max: 0 },
    ),
  }));
}
