import type { GameMasterNicknameBody } from '@chimeres/contract';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Créer un MJ par son pseudo. */
export class AddGameMaster {
  /** `newId` donne l'identifiant du MJ : le domaine ne génère rien. */
  constructor(
    private readonly repository: ConventionRepository,
    private readonly newId: () => string,
  ) {}

  execute({ nickname }: GameMasterNicknameBody): Promise<void> {
    const id = this.newId();
    return changeConvention(this.repository, (convention) =>
      convention.addGameMaster(id, nickname),
    );
  }
}
