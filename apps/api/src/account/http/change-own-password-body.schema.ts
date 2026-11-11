import { PASSWORD_MAX_LENGTH, type ChangeOwnPasswordBody } from '@chimeres/contract';
import { z } from 'zod';

/**
 * Forme du corps de `PUT account/password`. Un mot de passe bien plus long que le maximum est
 * illisible (400) : il ne passe pas par scrypt. Le domaine vérifie les bornes du nouveau.
 */
export const changeOwnPasswordBodySchema = z.strictObject({
  currentPassword: z.string().max(PASSWORD_MAX_LENGTH * 4),
  password: z.string().max(PASSWORD_MAX_LENGTH * 4),
}) satisfies z.ZodType<ChangeOwnPasswordBody>;
