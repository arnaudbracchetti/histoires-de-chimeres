import type { SwapGamesBody } from '@chimeres/contract';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Échanger deux parties : chacune prend la place de l'autre, en un seul geste (PR-17, PR-5). */
export class SwapGames {
  constructor(private readonly repository: ConventionRepository) {}

  execute(gameId: string, { otherGameId }: SwapGamesBody): Promise<void> {
    return changeConvention(this.repository, (convention) =>
      convention.swapGames(gameId, otherGameId),
    );
  }
}
