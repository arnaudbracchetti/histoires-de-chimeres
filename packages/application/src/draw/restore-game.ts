import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Rétablir une partie annulée dans le tirage provisoire de son premier créneau (TI-6). */
export class RestoreGame {
  constructor(private readonly conventions: ConventionRepository) {}

  async execute(gameId: string): Promise<void> {
    await changeConvention(this.conventions, (convention) => convention.restoreGame(gameId));
  }
}
