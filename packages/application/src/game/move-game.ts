import type { MoveGameBody } from '@chimeres/contract';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { NotificationSender } from '../notification/notification-sender.js';

/** Déplacer une partie sur un autre créneau ou une autre table (PR-17, PR-5), et prévenir ses inscrits (NO-2). */
export class MoveGame {
  constructor(
    private readonly repository: ConventionRepository,
    private readonly notifications: NotificationSender,
  ) {}

  async execute(gameId: string, { timeSlotId, tableId }: MoveGameBody): Promise<void> {
    this.notifications.send(
      await changeConvention(this.repository, (convention) =>
        convention.moveGame(gameId, timeSlotId, tableId),
      ),
    );
  }
}
