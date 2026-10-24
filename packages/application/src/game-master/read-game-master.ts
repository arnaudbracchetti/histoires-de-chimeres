import type { GameMasterDto } from '@chimeres/contract';
import type { Withdrawal } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { GameMasterReader } from './game-master-reader.js';

/** La fiche d'un MJ : sa lecture, et le verdict de retrait de chaque disponibilité. */
export type GameMasterSheet = GameMasterDto & { withdrawals: Withdrawal[] };

/** La fiche d'un MJ, avec les verdicts de retrait que la convention calcule (PR-15). */
export class ReadGameMaster {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly reader: GameMasterReader,
  ) {}

  /** La fiche, ou `null` si le MJ n'existe pas. */
  async execute(gameMasterId: string): Promise<GameMasterSheet | null> {
    const gameMaster = await this.reader.read(gameMasterId);
    if (!gameMaster) return null;
    const withdrawals = (await this.conventions.get()).withdrawalsOfGameMaster(gameMasterId);
    return { ...gameMaster, withdrawals };
  }
}
