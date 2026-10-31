import type { TimeOfDay } from './time-of-day.js';

/** Créneau : une plage horaire de la journée. Entité de l'agrégat Convention, qui en garde les règles. */
export class TimeSlot {
  constructor(
    readonly id: string,
    readonly start: TimeOfDay,
    readonly end: TimeOfDay,
  ) {}

  /** Deux créneaux bout à bout ne se chevauchent pas : la fin est exclue de la plage. */
  overlapsTimeSlot(other: TimeSlot): boolean {
    return this.start.isBefore(other.end) && other.start.isBefore(this.end);
  }

  /** L'heure tombe pendant le créneau, fin exclue. */
  includesTime(time: TimeOfDay): boolean {
    return !time.isBefore(this.start) && time.isBefore(this.end);
  }
}
