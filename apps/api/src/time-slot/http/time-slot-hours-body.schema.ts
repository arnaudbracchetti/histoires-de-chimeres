import type { TimeSlotHoursBody } from '@chimeres/contract';
import { z } from 'zod';

/** Une heure du jour, `HH:MM`, de 00:00 à 23:59. */
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Forme du corps des heures d'un créneau. Fin avant le début et chevauchement sont des règles du domaine (422). */
export const timeSlotHoursBodySchema = z.strictObject({
  start: timeOfDay,
  end: timeOfDay,
}) satisfies z.ZodType<TimeSlotHoursBody>;
