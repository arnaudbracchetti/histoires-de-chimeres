import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ReadPlacements, ReadSchedule, ScheduleGame } from '@chimeres/application';
import { scheduleEndpoints, type ResponseOf, type ScheduleGameBody } from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { messageOf } from '../../http/problem-catalogue.js';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { scheduleGameBodySchema } from './schedule-game-body.schema.js';

@Controller()
export class ScheduleController {
  constructor(
    @Inject(ReadSchedule) private readonly readSchedule: ReadSchedule,
    @Inject(ReadPlacements) private readonly readPlacements: ReadPlacements,
    @Inject(ScheduleGame) private readonly scheduleGame: ScheduleGame,
  ) {}

  @Get(scheduleEndpoints.read.path)
  read(): Promise<ResponseOf<typeof scheduleEndpoints.read>> {
    return this.readSchedule.execute();
  }

  /** Chaque case refusée porte le motif et la phrase du refus que l'écriture lèverait. */
  @Get(scheduleEndpoints.placements.path)
  async placements(
    @Param('scenarioId') scenarioId: string,
  ): Promise<ResponseOf<typeof scheduleEndpoints.placements>> {
    const placements = await this.readPlacements.execute(scenarioId);
    if (!placements) throw new Refusal('scenario-not-found', {});
    return placements.map(({ timeSlotId, tableId, refusal }) => ({
      timeSlotId,
      tableId,
      refusal: refusal && { code: refusal.code, ...messageOf(refusal.code, refusal.params) },
    }));
  }

  /** Renvoie le programme relu. */
  @Post(scheduleEndpoints.schedule.path)
  async schedule(
    @Body(new ZodBody(scheduleGameBodySchema)) body: ScheduleGameBody,
  ): Promise<ResponseOf<typeof scheduleEndpoints.schedule>> {
    await this.scheduleGame.execute(body);
    return this.readSchedule.execute();
  }
}
