import type { Placement } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** La grille des verdicts de déplacement d'une partie, que la convention calcule avec la règle de l'écriture. */
export class ReadMovePlacements {
  constructor(private readonly conventions: ConventionRepository) {}

  /** Une partie inconnue est un refus du domaine (`game-not-found`). */
  async execute(gameId: string): Promise<Placement[]> {
    return (await this.conventions.get()).movePlacementsOf(gameId);
  }
}
