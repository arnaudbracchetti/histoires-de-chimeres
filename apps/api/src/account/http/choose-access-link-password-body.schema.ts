import { PASSWORD_MAX_LENGTH, type ChooseAccessLinkPasswordBody } from '@chimeres/contract';
import { z } from 'zod';

/** Forme du corps du choix du mot de passe par un lien d'accès. Les règles restent au domaine. */
export const chooseAccessLinkPasswordBodySchema = z.strictObject({
  password: z.string().max(PASSWORD_MAX_LENGTH * 4),
}) satisfies z.ZodType<ChooseAccessLinkPasswordBody>;
