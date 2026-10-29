import type { LinkPhoneBody } from '@chimeres/contract';
import { z } from 'zod';

/** Forme du corps de `POST front-office/linked-phone`. Pseudo et code sont vérifiés par le domaine (422). */
export const linkPhoneBodySchema = z.strictObject({
  presenceCode: z.string(),
  nickname: z.string(),
  confirmation: z.enum(['participant', 'game-master']).nullable(),
}) satisfies z.ZodType<LinkPhoneBody>;
