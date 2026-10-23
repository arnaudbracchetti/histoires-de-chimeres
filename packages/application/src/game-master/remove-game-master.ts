import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Supprimer un MJ. */
export class RemoveGameMaster {
  constructor(private readonly repository: ConventionRepository) {}

  execute(gameMasterId: string): Promise<void> {
    return changeConvention(this.repository, (convention) =>
      convention.removeGameMaster(gameMasterId),
    );
  }
}
