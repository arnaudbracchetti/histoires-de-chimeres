import type { Scenario } from '@chimeres/domain';

/** Port du dépôt des images de scénario (ADR 0007). */
export interface ScenarioImageRepository {
  /**
   * Écrit l'image du scénario, `bytes` sous son `imageId`, ou aucune avec `null`, et supprime ses
   * autres images. La référence du scénario et les octets s'écrivent dans la même transaction.
   */
  save(scenario: Scenario, bytes: Uint8Array | null): Promise<void>;
}
