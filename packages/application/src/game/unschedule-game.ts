import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Déprogrammer une partie (PR-17). */
export class UnscheduleGame {
  constructor(private readonly repository: ConventionRepository) {}

  execute(gameId: string): Promise<void> {
    return changeConvention(this.repository, (convention) => convention.unschedule(gameId));
  }
}
