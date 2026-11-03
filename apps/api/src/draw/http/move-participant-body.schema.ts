import type { MoveParticipantBody } from '@chimeres/contract';
import { z } from 'zod';

/** Forme du corps d'un déplacement : la partie, ou `null` pour les non placés. Le reste est au domaine (422). */
export const moveParticipantBodySchema = z.strictObject({
  gameId: z.string().nullable(),
}) satisfies z.ZodType<MoveParticipantBody>;
