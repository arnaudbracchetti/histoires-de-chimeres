import type { TimeSlotDto } from '@chimeres/contract';

/**
 * Ce que la fiche, le dialogue de placement et les confirmations lisent d'un créneau : le
 * Calendrier leur passe ceux de la convention, le pilotage ceux du suivi.
 */
export type GridTimeSlot = Pick<TimeSlotDto, 'id' | 'rank' | 'start' | 'end'>;
