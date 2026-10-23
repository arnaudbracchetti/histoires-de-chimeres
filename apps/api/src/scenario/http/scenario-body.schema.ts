import type { ScenarioBody } from '@chimeres/contract';
import { z } from 'zod';

/**
 * Forme du corps d'un scénario : des textes, des places entières, une durée d'un ou deux créneaux.
 * Champ vide, trop long ou places dans le désordre sont des règles du domaine (422).
 */
export const scenarioBodySchema = z.strictObject({
  title: z.string(),
  system: z.string(),
  presentation: z.string(),
  contentWarnings: z.string(),
  seats: z.strictObject({ min: z.number().int(), max: z.number().int() }),
  duration: z.union([z.literal(1), z.literal(2)]),
}) satisfies z.ZodType<ScenarioBody>;
