import type { Placement } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/** La grille des verdicts d'un scénario, que la convention calcule avec la règle de l'écriture. */
export class ReadPlacements {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
  ) {}

  /** Les verdicts, ou `null` si le scénario n'existe pas. */
  async execute(scenarioId: string): Promise<Placement[] | null> {
    const scenario = await this.scenarios.findById(scenarioId);
    if (!scenario) return null;
    return (await this.conventions.get()).placementsOfScenario(scenario);
  }
}
