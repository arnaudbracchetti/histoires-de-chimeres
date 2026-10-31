import type { ScheduleGameBody } from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { NotificationSender } from '../notification/notification-sender.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/**
 * Programmer un scénario sur un créneau et une table (PR-3, PR-5), et prévenir de la nouvelle partie
 * ceux qui peuvent s'y inscrire, et son MJ (NO-2).
 */
export class ScheduleGame {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly notifications: NotificationSender,
    private readonly newId: () => string,
  ) {}

  async execute({ scenarioId, timeSlotId, tableId }: ScheduleGameBody): Promise<void> {
    const scenario = await this.scenarios.findById(scenarioId);
    if (!scenario) throw new Refusal('scenario-not-found', {});
    const id = this.newId();
    this.notifications.send(
      await changeConvention(this.conventions, (convention) =>
        convention.scheduleScenario(id, scenario, timeSlotId, tableId),
      ),
    );
  }
}
