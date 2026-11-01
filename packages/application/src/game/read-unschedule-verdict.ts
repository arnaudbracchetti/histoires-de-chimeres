import type { UnscheduleVerdict } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Le verdict de la déprogrammation d'une partie : les inscriptions qu'elle retirerait (IN-6). */
export class ReadUnscheduleVerdict {
  constructor(private readonly conventions: ConventionRepository) {}

  /** Une partie inconnue est un refus du domaine (`game-not-found`). */
  async execute(gameId: string): Promise<UnscheduleVerdict> {
    return (await this.conventions.get()).computeUnscheduleVerdict(gameId);
  }
}
