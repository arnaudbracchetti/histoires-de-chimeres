import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Supprimer une table. */
export class RemoveTable {
  constructor(private readonly repository: ConventionRepository) {}

  execute(tableId: string): Promise<void> {
    return changeConvention(this.repository, (convention) => convention.removeTable(tableId));
  }
}
