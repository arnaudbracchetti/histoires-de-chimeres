import type { GameDto, TableDto } from '@chimeres/contract';
import { fr } from '@chimeres/design';
import type { GridTimeSlot } from './grid-time-slot';

/**
 * L'annonce d'une partie programmée : « Partie « Néons » programmée : créneau 2, Dragon. ». Le
 * Calendrier et le pilotage la font lire par la région `aria-live` de la coquille.
 */
export function describeScheduledGame(
  game: GameDto,
  timeSlots: readonly GridTimeSlot[],
  tables: readonly TableDto[],
): string {
  const slot = timeSlots.find(({ id }) => id === game.timeSlotIds[0]);
  const table = tables.find(({ id }) => id === game.tableId);
  return fr`Partie « ${game.scenario.title} » programmée : créneau ${slot?.rank}, ${table?.name}.`;
}

/**
 * L'annonce d'une partie déplacée, ou échangée avec `other` : « Partie déplacée : créneau 2, table
 * Dragon. », « Parties « A » et « B » échangées. ». Le Calendrier et le pilotage la font lire par la
 * région `aria-live` de la coquille.
 */
export function describeMovedGame(
  moved: GameDto,
  other: GameDto | undefined,
  timeSlots: readonly GridTimeSlot[],
  tables: readonly TableDto[],
): string {
  if (other)
    return fr`Parties « ${moved.scenario.title} » et « ${other.scenario.title} » échangées.`;
  const slot = timeSlots.find(({ id }) => id === moved.timeSlotIds[0]);
  const table = tables.find(({ id }) => id === moved.tableId);
  return fr`Partie déplacée : créneau ${slot?.rank}, table ${table?.name}.`;
}

/** L'annonce d'une partie déprogrammée : « Partie « Néons » déprogrammée. ». */
export function describeUnscheduledGame(game: GameDto): string {
  return fr`Partie « ${game.scenario.title} » déprogrammée.`;
}
