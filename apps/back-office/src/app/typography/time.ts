import type { TimeSlotDto } from '@chimeres/contract';
import { minutesOf } from '../time-slots/time-format';
import { NBSP, plural, THIN_NBSP } from './french';

/** « 14 h 00 », « 9 h 30 ». */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${Number(hours)}${NBSP}h${NBSP}${minutes}`;
}

/** « 14 h 00 – 16 h 30 » : demi-cadratin entouré d'espaces fines insécables. */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)}${THIN_NBSP}–${THIN_NBSP}${formatTime(end)}`;
}

/** Durée de `start` à `end` : « 2 h 30 », « 2 h », « 45 min ». */
export function formatDuration(start: string, end: string): string {
  const total = minutesOf(end) - minutesOf(start);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}${NBSP}min`;
  if (minutes === 0) return `${hours}${NBSP}h`;
  return `${hours}${NBSP}h${NBSP}${String(minutes).padStart(2, '0')}`;
}

/** « Créneau 2 · 14 h 00 – 16 h 30 » : un créneau est désigné par son rang (PR-8). */
export function timeSlotLabel({
  rank,
  start,
  end,
}: Pick<TimeSlotDto, 'rank' | 'start' | 'end'>): string {
  return `Créneau ${rank} · ${formatTimeRange(start, end)}`;
}

const RANKS = new Intl.ListFormat('fr', { type: 'conjunction' });

/** « créneau 2 », « créneaux 1, 2 et 4 » : des créneaux par leur rang. `''` sans aucun. */
export function formatTimeSlotRanks(ranks: readonly number[]): string {
  if (!ranks.length) return '';
  return `${plural(ranks.length, 'créneau', 'créneaux')} ${RANKS.format(ranks.map(String))}`;
}
