import { NBSP, plural, THIN_NBSP } from './french.js';

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
}: {
  rank: number;
  start: string;
  end: string;
}): string {
  return `Créneau ${rank} · ${formatTimeRange(start, end)}`;
}

const RANKS = new Intl.ListFormat('fr', { type: 'conjunction' });

/** « créneau 2 », « créneaux 1, 2 et 4 » : des créneaux par leur rang. `''` sans aucun. */
export function formatTimeSlotRanks(ranks: readonly number[]): string {
  if (!ranks.length) return '';
  return `${plural(ranks.length, 'créneau', 'créneaux')} ${RANKS.format(ranks.map(String))}`;
}

/**
 * Heure saisie, sur 24 heures, remise en `HH:MM` : « 14:00 », « 9:30 », « 9 », « 14h », « 14h30 ».
 * `undefined` si ce n'est pas une heure de 00:00 à 23:59.
 */
export function normalizeTime(text: string): string | undefined {
  const match = /^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?$/i.exec(text.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return undefined;
  return timeOf(hours * 60 + minutes);
}

/** Minutes depuis minuit d'une heure `HH:MM`. */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

/** Heure `HH:MM` de minutes depuis minuit. */
export function timeOf(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
