import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { NotificationSender } from '../notification/notification-sender.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/**
 * Publier le tirage provisoire d'un créneau (TI-7), et prévenir les joueurs, les non placés et les
 * MJ (NO-2). Le catalogue donne les places maximum des parties.
 */
export class PublishDraw {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly notifications: NotificationSender,
  ) {}

  async execute(timeSlotId: string): Promise<void> {
    const catalogue = await this.scenarios.catalogue();
    this.notifications.send(
      await changeConvention(this.conventions, (convention) =>
        convention.publishDraw(timeSlotId, catalogue),
      ),
    );
  }
}
