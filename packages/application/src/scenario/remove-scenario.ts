import { Refusal } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from './scenario-repository.js';

/**
 * Supprimer un scénario qui n'a aucune partie (PR-14). Une partie programmée entre la lecture de la
 * convention et la suppression bute sur la clé étrangère de la partie vers son scénario.
 */
export class RemoveScenario {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
  ) {}

  async execute(scenarioId: string): Promise<void> {
    const scenario = await this.scenarios.findById(scenarioId);
    if (!scenario) throw new Refusal('scenario-not-found', {});
    scenario.verifyRemovable(await this.conventions.get());
    await this.scenarios.remove(scenario);
  }
}
