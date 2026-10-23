import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/** Supprimer un MJ qui n'a aucun scénario (PR-12). */
export class RemoveGameMaster {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
  ) {}

  /**
   * Le catalogue est lu avant la convention. Un scénario proposé entre les deux bute sur la clé
   * étrangère du scénario vers son MJ, qui sert de filet.
   */
  async execute(gameMasterId: string): Promise<void> {
    const catalogue = await this.scenarios.catalogue();
    await changeConvention(this.conventions, (convention) =>
      convention.removeGameMaster(gameMasterId, catalogue),
    );
  }
}
