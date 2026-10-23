import type { ScenarioBody } from '@chimeres/contract';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from './scenario-repository.js';

/** Proposer un scénario pour un MJ (PR-1, PR-16). */
export class ProposeScenario {
  /** `newId` donne l'identifiant du scénario : le domaine ne génère rien. */
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly newId: () => string,
  ) {}

  /** Renvoie l'identifiant du scénario créé. */
  async execute(gameMasterId: string, body: ScenarioBody): Promise<string> {
    const convention = await this.conventions.get();
    const scenario = convention.proposeScenario(this.newId(), gameMasterId, body);
    await this.scenarios.save(scenario);
    return scenario.id;
  }
}
