import { Controller, Delete, Inject, Param, Put } from '@nestjs/common';
import {
  DeclareAvailability,
  WithdrawAvailability,
  type GameMasterReader,
} from '@chimeres/application';
import { availabilityEndpoints, type ResponseOf } from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { GAME_MASTER_READER } from '../game-master-reader.token.js';

/** Chaque écriture renvoie la fiche du MJ relue. */
@Controller()
export class AvailabilityController {
  constructor(
    @Inject(GAME_MASTER_READER) private readonly reader: GameMasterReader,
    @Inject(DeclareAvailability) private readonly declareAvailability: DeclareAvailability,
    @Inject(WithdrawAvailability) private readonly withdrawAvailability: WithdrawAvailability,
  ) {}

  @Put(availabilityEndpoints.declare.path)
  async declare(
    @Param('gameMasterId') gameMasterId: string,
    @Param('timeSlotId') timeSlotId: string,
  ): Promise<ResponseOf<typeof availabilityEndpoints.declare>> {
    await this.declareAvailability.execute(gameMasterId, timeSlotId);
    return this.readOrRefuse(gameMasterId);
  }

  @Delete(availabilityEndpoints.withdraw.path)
  async withdraw(
    @Param('gameMasterId') gameMasterId: string,
    @Param('timeSlotId') timeSlotId: string,
  ): Promise<ResponseOf<typeof availabilityEndpoints.withdraw>> {
    await this.withdrawAvailability.execute(gameMasterId, timeSlotId);
    return this.readOrRefuse(gameMasterId);
  }

  /** Le MJ a pu être supprimé entre l'écriture et la relecture. */
  private async readOrRefuse(gameMasterId: string) {
    const gameMaster = await this.reader.read(gameMasterId);
    if (!gameMaster) throw new Refusal('game-master-not-found', {});
    return gameMaster;
  }
}
