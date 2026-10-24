import { Controller, Delete, Inject, Param, Put } from '@nestjs/common';
import { DeclareAvailability, ReadGameMaster, WithdrawAvailability } from '@chimeres/application';
import { availabilityEndpoints, type ResponseOf } from '@chimeres/contract';
import { readSheetOrRefuse } from './game-master-sheet.js';

/** Chaque écriture renvoie la fiche du MJ relue. */
@Controller()
export class AvailabilityController {
  constructor(
    @Inject(ReadGameMaster) private readonly readGameMaster: ReadGameMaster,
    @Inject(DeclareAvailability) private readonly declareAvailability: DeclareAvailability,
    @Inject(WithdrawAvailability) private readonly withdrawAvailability: WithdrawAvailability,
  ) {}

  @Put(availabilityEndpoints.declare.path)
  async declare(
    @Param('gameMasterId') gameMasterId: string,
    @Param('timeSlotId') timeSlotId: string,
  ): Promise<ResponseOf<typeof availabilityEndpoints.declare>> {
    await this.declareAvailability.execute(gameMasterId, timeSlotId);
    return readSheetOrRefuse(this.readGameMaster, gameMasterId);
  }

  @Delete(availabilityEndpoints.withdraw.path)
  async withdraw(
    @Param('gameMasterId') gameMasterId: string,
    @Param('timeSlotId') timeSlotId: string,
  ): Promise<ResponseOf<typeof availabilityEndpoints.withdraw>> {
    await this.withdrawAvailability.execute(gameMasterId, timeSlotId);
    return readSheetOrRefuse(this.readGameMaster, gameMasterId);
  }
}
