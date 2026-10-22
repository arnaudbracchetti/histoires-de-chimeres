import type { TableNameBody } from '@chimeres/contract';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Renommer une table. */
export class RenameTable {
  constructor(private readonly repository: ConventionRepository) {}

  execute(tableId: string, { name }: TableNameBody): Promise<void> {
    return changeConvention(this.repository, (convention) => convention.renameTable(tableId, name));
  }
}
