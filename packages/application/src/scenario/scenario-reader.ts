import type { ScenarioDto, ScenarioListItemDto } from '@chimeres/contract';

/** Port de lecture des scénarios, implémenté par l'infrastructure. */
export interface ScenarioReader {
  /** Tous les scénarios, dans l'ordre naturel de leur titre. */
  list(): Promise<ScenarioListItemDto[]>;
  /** Le scénario, ou `null` s'il n'existe pas. */
  read(scenarioId: string): Promise<ScenarioDto | null>;
}
