import type { TimeOfDay } from './time-of-day.js';

/** Un instant à l'heure locale de la convention (Europe/Paris) : sa date `AAAA-MM-JJ` et son heure. */
export type LocalMoment = { date: string; time: TimeOfDay };
