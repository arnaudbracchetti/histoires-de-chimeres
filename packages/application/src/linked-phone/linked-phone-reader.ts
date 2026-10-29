import type { LinkedPhoneDto } from '@chimeres/contract';

/** Port de lecture des téléphones reliés, implémenté par l'infrastructure. */
export interface LinkedPhoneReader {
  /** Le pseudo du téléphone relié, ou `null` si ce téléphone n'est relié à aucun pseudo. */
  read(phoneId: string): Promise<LinkedPhoneDto | null>;
}
