import { PASSWORD_MAX_LENGTH, type LogInBody } from '@chimeres/contract';
import { z } from 'zod';

/**
 * Forme du corps de `POST account/session`. Un mot de passe bien plus long que le maximum est
 * illisible (400) : il ne passe pas par scrypt.
 */
export const logInBodySchema = z.strictObject({
  nickname: z.string().max(200),
  password: z.string().max(PASSWORD_MAX_LENGTH * 4),
}) satisfies z.ZodType<LogInBody>;
