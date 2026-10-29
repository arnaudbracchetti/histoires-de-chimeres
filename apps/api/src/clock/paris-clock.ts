import { Injectable } from '@nestjs/common';
import type { Clock } from '@chimeres/application';
import { TimeOfDay, type LocalMoment } from '@chimeres/domain';

/** La convention se tient à Paris : son heure locale est fixée dans le code. */
const PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** L'instant, à l'heure de Paris. */
export function parisMomentOf(instant: Date): LocalMoment {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    PARIS.formatToParts(instant).find((p) => p.type === type)!.value;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: TimeOfDay.parse(`${part('hour')}:${part('minute')}`),
  };
}

@Injectable()
export class ParisClock implements Clock {
  now(): LocalMoment {
    return parisMomentOf(new Date());
  }
}
