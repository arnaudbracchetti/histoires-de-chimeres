import type { LocalMoment } from './local-moment.js';
import type { TimeOfDay } from './time-of-day.js';

/**
 * La fin de la convention : la fin de son dernier créneau, le jour de sa date. Sans date ou sans
 * créneau, elle n'en a pas : les Organisateurs testent le front office avant le jour J. Les créneaux
 * ne se chevauchent pas, donc le dernier est celui qui finit le plus tard.
 */
export function endOfConvention(
  date: string | null,
  timeSlotEnds: readonly TimeOfDay[],
): LocalMoment | null {
  const [first, ...others] = timeSlotEnds;
  if (date === null || !first) return null;
  return { date, time: others.reduce((last, end) => (last.isBefore(end) ? end : last), first) };
}
