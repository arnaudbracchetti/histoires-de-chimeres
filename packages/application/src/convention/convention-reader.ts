import type { ConventionDto } from '@chimeres/contract';

/** Port de lecture, implémenté par l'infrastructure. La convention existe toujours. */
export interface ConventionReader {
  read(): Promise<ConventionDto>;
}
