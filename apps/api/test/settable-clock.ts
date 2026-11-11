import type { Clock } from '@chimeres/application';
import type { LocalMoment } from '@chimeres/domain';
import { instantOfParisMoment, parisMomentOf } from '../src/clock/paris-clock.js';

/** Une horloge que le test règle et avance, à l'heure de Paris. */
export class SettableClock implements Clock {
  private instant: Date;

  constructor(start: string) {
    this.instant = new Date(start);
  }

  now(): LocalMoment {
    return parisMomentOf(this.instant);
  }

  /** Avance l'horloge de tant de minutes. */
  advanceMinutes(minutes: number): void {
    this.instant = new Date(instantOfParisMoment(this.now()).getTime() + minutes * 60_000);
  }

  advanceDays(days: number): void {
    this.advanceMinutes(days * 24 * 60);
  }
}
