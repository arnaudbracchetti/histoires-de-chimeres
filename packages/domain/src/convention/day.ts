import { Refusal } from '../refusal.js';
import type { TimeOfDay } from './time-of-day.js';
import { TimeSlot } from './time-slot.js';

/**
 * Journée : les créneaux de la convention, dans l'ordre de la journée. Elle dit le rang de chaque
 * créneau et quels créneaux sont consécutifs (PR-8). Immuable : chaque geste rend une autre journée.
 */
export class Day {
  private constructor(readonly timeSlots: readonly TimeSlot[]) {}

  /** `timeSlots`, dans n'importe quel ordre. */
  static ordering(timeSlots: Iterable<TimeSlot>): Day {
    return new Day([...timeSlots].sort((a, b) => a.start.minutes - b.start.minutes));
  }

  /** Rang du créneau dans la journée, à partir de 1 (PR-8) ; 0 s'il n'en fait pas partie. */
  rankOfTimeSlot(timeSlotId: string): number {
    return this.timeSlots.findIndex((slot) => slot.id === timeSlotId) + 1;
  }

  /** Refuse un créneau qui n'existe pas. */
  verifyTimeSlotExists(timeSlotId: string): void {
    this.existingTimeSlot(timeSlotId);
  }

  /** Le créneau, qui doit exister. */
  existingTimeSlot(timeSlotId: string): TimeSlot {
    const slot = this.timeSlots.find((candidate) => candidate.id === timeSlotId);
    if (!slot) throw new Refusal('time-slot-not-found', {});
    return slot;
  }

  /** Les `length` créneaux consécutifs à partir de `timeSlotId` (PR-8), ou `null` s'ils manquent. */
  consecutiveTimeSlotIdsFrom(timeSlotId: string, length: number): string[] | null {
    const start = this.timeSlots.findIndex((slot) => slot.id === timeSlotId);
    if (start < 0) return null;
    const following = this.timeSlots.slice(start, start + length);
    return following.length === length ? following.map(({ id }) => id) : null;
  }

  /** La journée après l'ajout d'un créneau, qui doit y tenir (PR-8). */
  afterAdding(id: string, start: TimeOfDay, end: TimeOfDay): Day {
    return this.afterFitting(new TimeSlot(id, start, end));
  }

  /** La journée après le changement d'heures d'un créneau existant, qui doit encore y tenir (PR-8). */
  afterChangingHours(id: string, start: TimeOfDay, end: TimeOfDay): Day {
    this.verifyTimeSlotExists(id);
    return this.afterFitting(new TimeSlot(id, start, end));
  }

  /** La journée après la suppression d'un créneau existant. */
  afterRemoving(id: string): Day {
    this.verifyTimeSlotExists(id);
    return new Day(this.timeSlots.filter((slot) => slot.id !== id));
  }

  /**
   * La journée avec `candidate`, à la place du créneau de même id s'il existe. Refuse un créneau qui
   * finit avant de commencer, ou qui chevauche un autre créneau, désigné par son rang actuel.
   */
  private afterFitting(candidate: TimeSlot): Day {
    if (!candidate.start.isBefore(candidate.end)) {
      throw new Refusal('time-slot-end-not-after-start', {});
    }
    const others = this.timeSlots.filter((slot) => slot.id !== candidate.id);
    const overlapped = others.find((slot) => slot.overlaps(candidate));
    if (overlapped) {
      const rank = this.rankOfTimeSlot(overlapped.id);
      throw overlapped.includes(candidate.start)
        ? new Refusal('time-slot-start-overlaps', { rank })
        : new Refusal('time-slot-end-overlaps', { rank });
    }
    return Day.ordering([...others, candidate]);
  }
}
