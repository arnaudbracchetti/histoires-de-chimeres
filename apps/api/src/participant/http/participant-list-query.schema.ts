import type { ParticipantListQuery } from '@chimeres/contract';
import { z } from 'zod';

/** Forme des paramètres de la liste : une recherche, d'un seul texte, ou aucune. */
export const participantListQuerySchema = z.strictObject({
  search: z.string().optional(),
}) satisfies z.ZodType<ParticipantListQuery>;
