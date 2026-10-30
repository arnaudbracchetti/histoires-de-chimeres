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

/**
 * L'instant d'un moment à l'heure de Paris. Le décalage se lit à l'instant visé, deux fois : la
 * première estimation peut tomber de l'autre côté d'un changement d'heure.
 */
export function instantOfParisMoment(moment: LocalMoment): Date {
  const asIfUniversal = universalMillisecondsOf(moment);
  let instant = asIfUniversal;
  for (let pass = 0; pass < 2; pass++) {
    instant = asIfUniversal - (universalMillisecondsOf(parisMomentOf(new Date(instant))) - instant);
  }
  return new Date(instant);
}

/** Le moment lu comme s'il était en temps universel, en millisecondes. */
function universalMillisecondsOf({ date, time }: LocalMoment): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day, 0, time.minutes);
}

@Injectable()
export class ParisClock implements Clock {
  now(): LocalMoment {
    return parisMomentOf(new Date());
  }
}
