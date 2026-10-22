import type { UpdateConventionBody } from '@chimeres/contract';
import { changeConvention } from './change-convention.js';
import type { ConventionRepository } from './convention-repository.js';

/** Renseigner la convention : son nom et sa date. */
export class UpdateConvention {
  constructor(private readonly repository: ConventionRepository) {}

  execute({ name, date }: UpdateConventionBody): Promise<void> {
    return changeConvention(this.repository, (convention) => {
      convention.rename(name);
      convention.setDate(date);
    });
  }
}
