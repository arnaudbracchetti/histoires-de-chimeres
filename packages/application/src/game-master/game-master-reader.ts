import type { GameMasterDto } from '@chimeres/contract';

/** Port de lecture des MJ, implémenté par l'infrastructure. */
export interface GameMasterReader {
  /** Les MJ, dans l'ordre naturel de leur pseudo. */
  list(): Promise<GameMasterDto[]>;
  /** Le MJ, ou `null` s'il n'existe pas. */
  read(gameMasterId: string): Promise<GameMasterDto | null>;
}
