import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/**
 * Annuler une partie dans le tirage provisoire de son premier créneau (TI-6). Le catalogue donne son
 * minimum. Aucune notification : elles partent à la publication.
 */
export class CancelGame {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
  ) {}

  async execute(gameId: string): Promise<void> {
    const catalogue = await this.scenarios.catalogue();
    await changeConvention(this.conventions, (convention) =>
      convention.cancelGame(gameId, catalogue),
    );
  }
}
