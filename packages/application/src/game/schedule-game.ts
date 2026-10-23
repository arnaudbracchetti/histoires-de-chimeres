import type { ScheduleGameBody } from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/** Programmer un scénario sur un créneau et une table (PR-3, PR-5). */
export class ScheduleGame {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly newId: () => string,
  ) {}

  async execute({ scenarioId, timeSlotId, tableId }: ScheduleGameBody): Promise<void> {
    const scenario = await this.scenarios.findById(scenarioId);
    if (!scenario) throw new Refusal('scenario-not-found', {});
    const id = this.newId();
    await changeConvention(this.conventions, (convention) =>
      convention.schedule(id, scenario, timeSlotId, tableId),
    );
  }
}
