import type { FrontOfficeGameDto, FrontOfficeScheduleDto } from '@chimeres/contract';
import { countOf, formatTimeRange, formatTimeSlotRanks } from '@chimeres/design';

/** « Aucun inscrit · 5 places », « 6 inscrits · 4 places » : les places maximum (§5.3). */
export function counterOf({ signUpCount, seats }: FrontOfficeGameDto): string {
  const signUps = signUpCount ? countOf(signUpCount, 'inscrit', 'inscrits') : 'Aucun inscrit';
  return `${signUps} · ${countOf(seats.max, 'place', 'places')}`;
}

/** Les créneaux d'une partie, dans l'ordre de la journée, tels que le programme les donne. */
export function timeSlotsOf(schedule: FrontOfficeScheduleDto, game: FrontOfficeGameDto) {
  return schedule.timeSlots.filter(({ id }) => game.timeSlotIds.includes(id));
}

/**
 * « Créneau 2 · 14 h 00 – 18 h 30 », « Créneaux 3 et 4 · 14 h 00 – 23 h 00 » pour une partie
 * double, de son premier début à sa dernière fin.
 */
export function timeSlotsLabelOf(
  schedule: FrontOfficeScheduleDto,
  game: FrontOfficeGameDto,
): string {
  const slots = timeSlotsOf(schedule, game);
  const range = formatTimeRange(slots[0]!.start, slots.at(-1)!.end);
  return `${ranksLabelOf(schedule, game)} · ${range}`;
}

/** « Créneau 2 », ou « Créneaux 3 et 4 » pour une partie double. */
export function ranksLabelOf(schedule: FrontOfficeScheduleDto, game: FrontOfficeGameDto): string {
  const label = formatTimeSlotRanks(ranksOf(schedule, game));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Les rangs des créneaux d'une partie. */
export function ranksOf(schedule: FrontOfficeScheduleDto, game: FrontOfficeGameDto): number[] {
  return timeSlotsOf(schedule, game).map(({ rank }) => rank);
}
