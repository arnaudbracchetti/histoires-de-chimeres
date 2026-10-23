import type { Scenario, ScenarioCatalogue } from '@chimeres/domain';

/** Port d'écriture des scénarios. */
export interface ScenarioRepository {
  /** Le scénario, ou `null` s'il n'existe pas. */
  findById(scenarioId: string): Promise<Scenario | null>;
  /** Le catalogue de tous les scénarios, sans présentations ni images (ADR 0005). */
  catalogue(): Promise<ScenarioCatalogue>;
  save(scenario: Scenario): Promise<void>;
  remove(scenario: Scenario): Promise<void>;
}
