import type { ScenarioBody } from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import type { ScenarioRepository } from './scenario-repository.js';

/** Modifier un scénario : son contenu, ses places et sa durée (PR-14). */
export class UpdateScenario {
  constructor(private readonly scenarios: ScenarioRepository) {}

  async execute(scenarioId: string, { seats, duration, ...content }: ScenarioBody): Promise<void> {
    const scenario = await this.scenarios.findById(scenarioId);
    if (!scenario) throw new Refusal('scenario-not-found', {});
    scenario.changeContent(content);
    scenario.changeSeats(seats);
    scenario.changeDuration(duration);
    await this.scenarios.save(scenario);
  }
}
