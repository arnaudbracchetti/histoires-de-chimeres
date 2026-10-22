import type { TableNameBody } from '@chimeres/contract';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Ajouter une table à la convention. */
export class AddTable {
  /** `newId` donne l'identifiant de la table : le domaine ne génère rien. */
  constructor(
    private readonly repository: ConventionRepository,
    private readonly newId: () => string,
  ) {}

  execute({ name }: TableNameBody): Promise<void> {
    const id = this.newId();
    return changeConvention(this.repository, (convention) => convention.addTable(id, name));
  }
}
