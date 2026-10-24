import type { DurationDto, SeatsDto } from '@chimeres/contract';
import { countOf, NBSP } from '../typography/french';

/** « 3 à 5 places », ou « 4 places » quand minimum et maximum sont égaux. */
export function formatSeats({ min, max }: SeatsDto): string {
  if (min === max) return countOf(min, 'place', 'places');
  return `${min} à ${max}${NBSP}places`;
}

/** « 1 créneau », « 2 créneaux » : la durée d'un scénario. */
export function formatScenarioDuration(duration: DurationDto): string {
  return countOf(duration, 'créneau', 'créneaux');
}
