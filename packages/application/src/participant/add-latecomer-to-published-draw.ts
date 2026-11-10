import type { Clock } from '../clock.js';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { NotificationSender } from '../notification/notification-sender.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/**
 * Un Organisateur ajoute un pseudo au tirage publié d'un créneau, non placé (ID-14). Le pseudo
 * reçoit « retardataire », avec les tables où il reste de la place, après la sauvegarde (NO-2,
 * ADR 0010).
 */
export class AddLatecomerToPublishedDraw {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly notifications: NotificationSender,
    private readonly clock: Clock,
  ) {}

  async execute(participantId: string, timeSlotId: string): Promise<void> {
    const catalogue = await this.scenarios.catalogue();
    const notifications = await changeConvention(this.conventions, (convention) =>
      convention.addLatecomerToPublishedDraw(
        participantId,
        timeSlotId,
        this.clock.now(),
        catalogue,
      ),
    );
    this.notifications.send(notifications);
  }
}
