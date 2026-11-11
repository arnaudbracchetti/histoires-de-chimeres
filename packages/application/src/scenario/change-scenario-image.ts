import { Refusal } from '@chimeres/domain';
import type { ImageProcessor } from './image-processor.js';
import type { ScenarioImageRepository } from './scenario-image-repository.js';
import type { ScenarioRepository } from './scenario-repository.js';

/** Changer l'image d'un scénario d'un MJ (PR-7) : chaque envoi crée une image d'identifiant neuf (ADR 0007). */
export class ChangeScenarioImage {
  constructor(
    private readonly scenarios: ScenarioRepository,
    private readonly processor: ImageProcessor,
    private readonly images: ScenarioImageRepository,
    private readonly newId: () => string,
  ) {}

  async execute(gameMasterId: string, scenarioId: string, bytes: Uint8Array): Promise<void> {
    const scenario = await this.scenarios.findScenarioOfGameMaster(gameMasterId, scenarioId);
    if (!scenario) throw new Refusal('scenario-not-found', {});
    const image = await this.processor.process(bytes);
    scenario.changeImage(this.newId());
    await this.images.save(scenario, image);
  }
}
