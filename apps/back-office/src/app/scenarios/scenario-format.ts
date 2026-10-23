import type { DurationDto, SeatsDto } from '@chimeres/contract';

/** « 3 à 5 places », ou « 4 places » quand minimum et maximum sont égaux. */
export function formatSeats({ min, max }: SeatsDto): string {
  if (min === max) return `${min} ${min > 1 ? 'places' : 'place'}`;
  return `${min} à ${max} places`;
}

/** « 1 créneau », « 2 créneaux ». */
export function formatDuration(duration: DurationDto): string {
  return duration === 1 ? '1 créneau' : '2 créneaux';
}
