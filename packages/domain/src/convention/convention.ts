import { Refusal } from '../refusal.js';
import type { TimeOfDay } from './time-of-day.js';
import { TimeSlot } from './time-slot.js';

export type ConventionState = {
  id: string;
  name: string;
  /** `AAAA-MM-JJ`, ou `null` tant qu'elle n'est pas fixée. */
  date: string | null;
  /** Dans n'importe quel ordre : `timeSlots` les rend dans l'ordre de la journée. */
  timeSlots: TimeSlot[];
  /** Numéro de version, pour le verrou optimiste : seul le repository le fait avancer. */
  version: number;
};

/** La convention, racine de l'agrégat. Une base n'en a qu'une. */
export class Convention {
  /** Reprise par `contract` (`CONVENTION_NAME_MAX_LENGTH`) ; un test d'`application` vérifie qu'elles concordent. */
  static readonly NAME_MAX_LENGTH = 80;

  private constructor(private state: ConventionState) {}

  static restore(state: ConventionState): Convention {
    return new Convention({ ...state, timeSlots: [...state.timeSlots] });
  }

  get id(): string {
    return this.state.id;
  }

  get name(): string {
    return this.state.name;
  }

  get date(): string | null {
    return this.state.date;
  }

  get version(): number {
    return this.state.version;
  }

  rename(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Refusal('convention-name-required', {});
    if (trimmed.length > Convention.NAME_MAX_LENGTH) {
      throw new Refusal('convention-name-too-long', { max: Convention.NAME_MAX_LENGTH });
    }
    this.state.name = trimmed;
  }

  /** Fixe la date (`AAAA-MM-JJ`), ou l'efface avec `null`. */
  setDate(date: string | null): void {
    this.state.date = date;
  }

  /** Les créneaux, dans l'ordre de la journée. */
  get timeSlots(): readonly TimeSlot[] {
    return [...this.state.timeSlots].sort((a, b) => a.start.minutes - b.start.minutes);
  }

  /** Rang du créneau dans la journée, à partir de 1 (PR-8). */
  rankOf(timeSlotId: string): number {
    return this.timeSlots.findIndex((slot) => slot.id === timeSlotId) + 1;
  }

  addTimeSlot(id: string, start: TimeOfDay, end: TimeOfDay): void {
    this.state.timeSlots.push(this.verifyFits(new TimeSlot(id, start, end)));
  }

  changeTimeSlotHours(id: string, start: TimeOfDay, end: TimeOfDay): void {
    const index = this.indexOf(id);
    this.state.timeSlots[index] = this.verifyFits(new TimeSlot(id, start, end));
  }

  removeTimeSlot(id: string): void {
    this.state.timeSlots.splice(this.indexOf(id), 1);
  }

  private indexOf(timeSlotId: string): number {
    const index = this.state.timeSlots.findIndex((slot) => slot.id === timeSlotId);
    if (index < 0) throw new Refusal('time-slot-not-found', {});
    return index;
  }

  /** Vérifie qu'un créneau tient dans la journée (PR-8), et le renvoie. */
  private verifyFits(candidate: TimeSlot): TimeSlot {
    if (!candidate.start.isBefore(candidate.end)) {
      throw new Refusal('time-slot-end-not-after-start', {});
    }
    const overlapped = this.timeSlots.find(
      (slot) => slot.id !== candidate.id && slot.overlaps(candidate),
    );
    if (overlapped) {
      const rank = this.rankOf(overlapped.id);
      throw overlapped.includes(candidate.start)
        ? new Refusal('time-slot-start-overlaps', { rank })
        : new Refusal('time-slot-end-overlaps', { rank });
    }
    return candidate;
  }
}
