import type { AddParticipantBody } from '@chimeres/contract';
import { z } from 'zod';

/**
 * Forme du corps de l'assistant « Créer un pseudo ». Pseudo vide, trop long ou déjà pris sont des
 * règles du domaine (422). Un rôle répété ne compte qu'une fois.
 */
export const addParticipantBodySchema = z.strictObject({
  nickname: z.string(),
  roles: z
    .array(z.enum(['organizer', 'game-master']))
    .transform((roles) => [...new Set(roles)])
    .optional(),
}) satisfies z.ZodType<AddParticipantBody>;
