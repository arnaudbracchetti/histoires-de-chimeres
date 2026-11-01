import { endpoint } from './endpoint.js';
import type { TimeSlotStateDto } from './front-office.js';
import type { TableDto } from './table.js';

/**
 * La capacité d'un créneau : de la somme des places minimum à la somme des places maximum des
 * parties qui y commencent.
 */
export type CapacityDto = { min: number; max: number };

/**
 * Le suivi des inscriptions d'un créneau. `demand` : les participants distincts qui ont au moins
 * une inscription active sur une partie qui y commence (IN-4). Une partie double ne compte que sur
 * son premier créneau.
 */
export type TimeSlotTrackingDto = {
  id: string;
  /** Rang dans la journée, à partir de 1 : « Créneau 2 » (PR-8). */
  rank: number;
  /** `HH:MM`. */
  start: string;
  /** `HH:MM`. */
  end: string;
  state: TimeSlotStateDto;
  demand: number;
  capacity: CapacityDto;
};

/** Le suivi des inscriptions : les créneaux, dans l'ordre de la journée, et les tables, dans l'ordre naturel. */
export type SignUpTrackingDto = {
  timeSlots: TimeSlotTrackingDto[];
  tables: TableDto[];
};

/** La page « Pilotage du jour J » lit tout ce qu'elle montre en une seule lecture. */
export const signUpTrackingEndpoints = {
  read: endpoint<SignUpTrackingDto>('GET', 'sign-up-tracking'),
};
