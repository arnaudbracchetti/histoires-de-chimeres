import type { FrontOfficeDto } from '@chimeres/contract';
import type { Clock } from '../clock.js';
import type { ConventionRepository } from './convention-repository.js';

/** Ce que le front office lit à son ouverture, tant que la convention n'est pas terminée. */
export class ReadFrontOffice {
  constructor(
    private readonly repository: ConventionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<FrontOfficeDto> {
    const convention = await this.repository.get();
    convention.verifyStillOpenAt(this.clock.now());
    return { conventionName: convention.name };
  }
}
