import type { ParticipantNicknameBody } from '@chimeres/contract';
import { z } from 'zod';

/**
 * Forme du corps du pseudo d'un participant. Pseudo vide, trop long ou déjà pris sont des règles du
 * domaine (422).
 */
export const participantNicknameBodySchema = z.strictObject({
  nickname: z.string(),
}) satisfies z.ZodType<ParticipantNicknameBody>;
