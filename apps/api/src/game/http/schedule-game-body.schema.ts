import type { MoveGameBody, ScheduleGameBody, SwapGamesBody } from '@chimeres/contract';
import { z } from 'zod';

/** Forme du corps de la programmation. Créneau, table ou scénario inconnus sont des refus du domaine (404). */
export const scheduleGameBodySchema = z.strictObject({
  scenarioId: z.string(),
  timeSlotId: z.string(),
  tableId: z.string(),
}) satisfies z.ZodType<ScheduleGameBody>;

/** Forme du corps d'un déplacement. Créneau ou table inconnus sont des refus du domaine (404). */
export const moveGameBodySchema = z.strictObject({
  timeSlotId: z.string(),
  tableId: z.string(),
}) satisfies z.ZodType<MoveGameBody>;

/** Forme du corps d'un échange. Une autre partie inconnue est un refus du domaine (404). */
export const swapGamesBodySchema = z.strictObject({
  otherGameId: z.string(),
}) satisfies z.ZodType<SwapGamesBody>;
