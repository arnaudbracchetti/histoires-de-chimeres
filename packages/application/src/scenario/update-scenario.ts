import type { ScenarioBody } from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { NotificationSender } from '../notification/notification-sender.js';
import type { ScenarioRepository } from './scenario-repository.js';

/**
 * Modifier un scénario : son contenu, ses places et sa durée (PR-14). La convention est lue avant
 * l'enregistrement : une partie programmée entre les deux ne bloque pas la durée. Une baisse des
 * places prévient les inscrits des parties qui passent en très demandées (NO-2, ADR 0010).
 */
export class UpdateScenario {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly notifications: NotificationSender,
  ) {}

  async execute(scenarioId: string, { seats, duration, ...content }: ScenarioBody): Promise<void> {
    const scenario = await this.scenarios.findById(scenarioId);
    if (!scenario) throw new Refusal('scenario-not-found', {});
    const convention = await this.conventions.get();
    const previousSeats = scenario.seats;
    scenario.changeContent(content);
    scenario.changeSeats(seats);
    scenario.changeDuration(duration, convention);
    await this.scenarios.save(scenario);
    this.notifications.send(
      convention.buildOversubscribedNotificationsAfterSeatsChange(scenario, previousSeats),
    );
  }
}
