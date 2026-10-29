import { endpoint } from './endpoint.js';
import type { TableDto } from './table.js';
import type { TimeSlotDto } from './time-slot.js';

/** Longueur maximale du nom de la convention. Le domaine reprend cette borne. */
export const CONVENTION_NAME_MAX_LENGTH = 80;

export type ConventionDto = {
  id: string;
  name: string;
  /** Date de la convention, `AAAA-MM-JJ`, ou `null` tant qu'elle n'est pas fixée. */
  date: string | null;
  /** Dans l'ordre de la journée. */
  timeSlots: TimeSlotDto[];
  /** Dans l'ordre naturel : « Table 2 » avant « Table 10 ». */
  tables: TableDto[];
  /**
   * La fin de la convention : la fin de son dernier créneau (`HH:MM`), le jour de sa date. `null`
   * sans date ou sans créneau : le front office ne se ferme pas.
   */
  end: { date: string; time: string } | null;
  /** Le code de présence (ID-2), fixé à la création de la convention. */
  presenceCode: string;
};

export type UpdateConventionBody = {
  name: string;
  /** `AAAA-MM-JJ`, ou `null` pour effacer la date. */
  date: string | null;
};

export const conventionEndpoints = {
  read: endpoint<ConventionDto>('GET', 'convention'),
  update: endpoint<ConventionDto, never, UpdateConventionBody>('PUT', 'convention'),
};
