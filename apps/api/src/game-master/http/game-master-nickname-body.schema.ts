import type { GameMasterNicknameBody } from '@chimeres/contract';
import { z } from 'zod';

/** Forme du corps du pseudo d'un MJ. Pseudo vide, trop long ou déjà pris sont des règles du domaine (422). */
export const gameMasterNicknameBodySchema = z.strictObject({
  nickname: z.string(),
}) satisfies z.ZodType<GameMasterNicknameBody>;
