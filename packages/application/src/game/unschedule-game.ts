import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { NotificationSender } from '../notification/notification-sender.js';

/** Déprogrammer une partie (PR-17), et prévenir ses inscrits et son MJ (NO-2). */
export class UnscheduleGame {
  constructor(
    private readonly repository: ConventionRepository,
    private readonly notifications: NotificationSender,
  ) {}

  async execute(gameId: string): Promise<void> {
    this.notifications.send(
      await changeConvention(this.repository, (convention) => convention.unschedule(gameId)),
    );
  }
}
