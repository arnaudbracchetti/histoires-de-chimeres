import type { PresenceCodeBody } from '@chimeres/contract';
import { z } from 'zod';

/** Forme du corps de `POST front-office/presence-code`. Un code faux est un refus du domaine (422). */
export const presenceCodeBodySchema = z.strictObject({
  presenceCode: z.string(),
}) satisfies z.ZodType<PresenceCodeBody>;
