import type { DurationDto, ScenarioSummaryDto } from '@chimeres/contract';
import { ComparableName } from '@chimeres/domain';
import type { Prisma } from '../../generated/prisma/client.js';

/** Ce qu'une liste lit d'un scénario : ni présentation, ni avertissements. */
export const SCENARIO_SUMMARY_SELECT = {
  id: true,
  title: true,
  system: true,
  seatsMin: true,
  seatsMax: true,
  duration: true,
} satisfies Prisma.ScenarioSelect;

type ScenarioSummaryRow = Prisma.ScenarioGetPayload<{ select: typeof SCENARIO_SUMMARY_SELECT }>;

export function toScenarioSummary({
  id,
  title,
  system,
  seatsMin,
  seatsMax,
  duration,
}: ScenarioSummaryRow): ScenarioSummaryDto {
  return {
    id,
    title,
    system,
    seats: { min: seatsMin, max: seatsMax },
    duration: duration as DurationDto,
    // L'image arrive avec son envoi (ADR 0007) : en attendant, l'illustration par défaut.
    imageUrl: null,
  };
}

/** L'ordre naturel des titres, que PostgreSQL ne sait pas reproduire : « Scénario 2 » avant « Scénario 10 ». */
export function byTitle(a: ScenarioSummaryDto, b: ScenarioSummaryDto): number {
  return ComparableName.of(a.title).compareTo(ComparableName.of(b.title));
}
