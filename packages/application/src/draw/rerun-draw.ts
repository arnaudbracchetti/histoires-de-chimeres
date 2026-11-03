import type { DrawAlgorithm, RandomSource } from '@chimeres/domain';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/**
 * Relancer le tirage provisoire d'un créneau (TI-6), avec l'algorithme de tirage et la source de
 * hasard câblés. Aucune notification.
 */
export class RerunDraw {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly algorithm: DrawAlgorithm,
    private readonly random: RandomSource,
  ) {}

  async execute(timeSlotId: string): Promise<void> {
    const catalogue = await this.scenarios.catalogue();
    await changeConvention(this.conventions, (convention) =>
      convention.rerunDraw(timeSlotId, catalogue, this.algorithm, this.random),
    );
  }
}
