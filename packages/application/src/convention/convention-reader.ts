import type { ConventionDto } from '@chimeres/contract';

/** Port de lecture, implémenté par l'infrastructure. `null` : aucune convention enregistrée. */
export interface ConventionReader {
  read(): Promise<ConventionDto | null>;
}
