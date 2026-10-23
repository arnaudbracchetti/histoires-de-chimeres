import { Refusal } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from './scenario-repository.js';

/** Supprimer un scénario (PR-14). */
export class RemoveScenario {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
  ) {}

  async execute(scenarioId: string): Promise<void> {
    const scenario = await this.scenarios.findById(scenarioId);
    if (!scenario) throw new Refusal('scenario-not-found', {});
    scenario.remove(await this.conventions.get());
    await this.scenarios.remove(scenario);
  }
}
