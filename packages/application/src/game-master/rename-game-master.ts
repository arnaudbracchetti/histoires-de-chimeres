import type { GameMasterNicknameBody } from '@chimeres/contract';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Changer le pseudo d'un MJ. */
export class RenameGameMaster {
  constructor(private readonly repository: ConventionRepository) {}

  execute(gameMasterId: string, { nickname }: GameMasterNicknameBody): Promise<void> {
    return changeConvention(this.repository, (convention) =>
      convention.renameGameMaster(gameMasterId, nickname),
    );
  }
}
