import type { ConnectedAccountDto } from '@chimeres/contract';

/** Port de lecture des comptes. */
export interface AccountReader {
  /** Le compte, avec le pseudo de son participant et son MJ, ou `null` s'il n'existe plus. */
  read(accountId: string): Promise<ConnectedAccountDto | null>;
}
