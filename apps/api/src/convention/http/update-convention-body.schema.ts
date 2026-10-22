import type { UpdateConventionBody } from '@chimeres/contract';
import { z } from 'zod';

/** Forme du corps de `PUT convention`. Le nom vide ou trop long est une règle du domaine (422). */
export const updateConventionBodySchema = z.strictObject({
  name: z.string(),
  date: z.iso.date().nullable(),
}) satisfies z.ZodType<UpdateConventionBody>;
