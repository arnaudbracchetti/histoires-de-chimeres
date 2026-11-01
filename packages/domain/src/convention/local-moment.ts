import type { TimeOfDay } from './time-of-day.js';

/** Un instant à l'heure locale de la convention (Europe/Paris) : sa date `AAAA-MM-JJ` et son heure. */
export type LocalMoment = { date: string; time: TimeOfDay };

/** La plus tardive de ces fins, le jour `date`, ou `null` sans date ou sans fin. */
export function computeLatestEnd(
  date: string | null,
  ends: readonly TimeOfDay[],
): LocalMoment | null {
  const [first, ...others] = ends;
  if (date === null || !first) return null;
  return { date, time: others.reduce((last, end) => (last.isBefore(end) ? end : last), first) };
}
