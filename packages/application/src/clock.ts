import type { LocalMoment } from '@chimeres/domain';

/** Port de l'heure courante, à l'heure locale de la convention. */
export interface Clock {
  now(): LocalMoment;
}
