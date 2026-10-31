import {
  apiUrl,
  scenarioEndpoints,
  type DurationDto,
  type ScenarioSummaryDto,
} from '@chimeres/contract';
import { ComparableName } from '@chimeres/domain';
import type { Prisma } from '../../generated/prisma/client.js';

/** Ce qu'une liste lit d'un scénario : ni présentation, ni avertissements, ni octets d'image. */
export const SCENARIO_SUMMARY_SELECT = {
  id: true,
  title: true,
  system: true,
  seatsMin: true,
  seatsMax: true,
  duration: true,
  imageId: true,
} satisfies Prisma.ScenarioSelect;

type ScenarioSummaryRow = Prisma.ScenarioGetPayload<{ select: typeof SCENARIO_SUMMARY_SELECT }>;

export function toScenarioSummary({
  id,
  title,
  system,
  seatsMin,
  seatsMax,
  duration,
  imageId,
}: ScenarioSummaryRow): ScenarioSummaryDto {
  return {
    id,
    title,
    system,
    seats: { min: seatsMin, max: seatsMax },
    duration: duration as DurationDto,
    // Une URL par image : elle change avec l'image (ADR 0007).
    imageUrl: imageId && apiUrl(scenarioEndpoints.readImage, { scenarioId: id, imageId }),
  };
}

/** L'ordre naturel des titres, que PostgreSQL ne sait pas reproduire : « Scénario 2 » avant « Scénario 10 ». */
export function byTitle(a: ScenarioSummaryDto, b: ScenarioSummaryDto): number {
  return ComparableName.createFromText(a.title).compareTo(ComparableName.createFromText(b.title));
}
