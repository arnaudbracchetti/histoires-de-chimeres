import { endpoint } from './endpoint.js';
import type { ConventionDto } from './convention.js';

/** Un créneau, tel que la lecture de la convention le renvoie. */
export type TimeSlotDto = {
  id: string;
  /** Rang dans la journée, à partir de 1 : « Créneau 2 » (PR-8). */
  rank: number;
  /** `HH:MM`. */
  start: string;
  /** `HH:MM`, après le début, le même jour. */
  end: string;
};

/** Heures d'un créneau, `HH:MM`. Corps de l'ajout et du changement d'heures. */
export type TimeSlotHoursBody = {
  start: string;
  end: string;
};

export type TimeSlotParams = { timeSlotId: string };

/** Chaque écriture renvoie la convention, avec ses créneaux et leurs rangs recalculés. */
export const timeSlotEndpoints = {
  add: endpoint<ConventionDto, never, TimeSlotHoursBody>('POST', 'time-slots'),
  changeHours: endpoint<ConventionDto, TimeSlotParams, TimeSlotHoursBody>(
    'PUT',
    'time-slots/:timeSlotId',
  ),
  remove: endpoint<ConventionDto, TimeSlotParams>('DELETE', 'time-slots/:timeSlotId'),
};
