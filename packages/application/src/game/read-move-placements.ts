import type { MovePlacement } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';

/**
 * La grille des verdicts de déplacement ou d'échange d'une partie, que la convention calcule avec la
 * règle de l'écriture.
 */
export class ReadMovePlacements {
  constructor(private readonly conventions: ConventionRepository) {}

  /** Une partie inconnue est un refus du domaine (`game-not-found`). */
  async execute(gameId: string): Promise<MovePlacement[]> {
    return (await this.conventions.get()).movePlacementsOfGame(gameId);
  }
}
