import { Refusal } from '@chimeres/domain';
import type { ScenarioImageRepository } from './scenario-image-repository.js';
import type { ScenarioRepository } from './scenario-repository.js';

/** Retirer l'image d'un scénario : l'illustration par défaut la remplace (PR-7). */
export class RemoveScenarioImage {
  constructor(
    private readonly scenarios: ScenarioRepository,
    private readonly images: ScenarioImageRepository,
  ) {}

  async execute(scenarioId: string): Promise<void> {
    const scenario = await this.scenarios.findById(scenarioId);
    if (!scenario) throw new Refusal('scenario-not-found', {});
    scenario.removeImage();
    await this.images.save(scenario, null);
  }
}
