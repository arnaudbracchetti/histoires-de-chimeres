import type { ScenarioDto } from '@chimeres/contract';

/** Port de lecture des scénarios, implémenté par l'infrastructure. */
export interface ScenarioReader {
  /** Le scénario, ou `null` s'il n'existe pas. */
  read(scenarioId: string): Promise<ScenarioDto | null>;
}
