import type { Scenario } from '@chimeres/domain';

/** Port d'écriture des scénarios. */
export interface ScenarioRepository {
  /** Le scénario, ou `null` s'il n'existe pas. */
  findById(scenarioId: string): Promise<Scenario | null>;
  save(scenario: Scenario): Promise<void>;
}
