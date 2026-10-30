import type { SwapGamesBody } from '@chimeres/contract';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { NotificationSender } from '../notification/notification-sender.js';

/**
 * Échanger deux parties : chacune prend la place de l'autre, en un seul geste (PR-17, PR-5), et
 * prévenir leurs inscrits (NO-2).
 */
export class SwapGames {
  constructor(
    private readonly repository: ConventionRepository,
    private readonly notifications: NotificationSender,
  ) {}

  async execute(gameId: string, { otherGameId }: SwapGamesBody): Promise<void> {
    this.notifications.send(
      await changeConvention(this.repository, (convention) =>
        convention.swapGames(gameId, otherGameId),
      ),
    );
  }
}
