import type { TableNameBody } from '@chimeres/contract';
import { z } from 'zod';

/** Forme du corps du nom d'une table. Nom vide, trop long ou déjà pris sont des règles du domaine (422). */
export const tableNameBodySchema = z.strictObject({
  name: z.string(),
}) satisfies z.ZodType<TableNameBody>;
