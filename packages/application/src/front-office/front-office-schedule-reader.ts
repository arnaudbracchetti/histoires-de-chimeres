import type { FrontOfficeScheduleDto } from '@chimeres/contract';

/** Port de lecture du programme du front office, implémenté par l'infrastructure. */
export interface FrontOfficeScheduleReader {
  read(): Promise<FrontOfficeScheduleDto>;
}
