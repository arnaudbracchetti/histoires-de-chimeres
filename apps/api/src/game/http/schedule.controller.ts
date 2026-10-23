import { Body, Controller, Delete, Get, Inject, Param, Post, Put } from '@nestjs/common';
import {
  MoveGame,
  ReadMovePlacements,
  ReadPlacements,
  ReadSchedule,
  ScheduleGame,
  UnscheduleGame,
  type Schedule,
} from '@chimeres/application';
import {
  scheduleEndpoints,
  type MoveGameBody,
  type ResponseOf,
  type ScheduleGameBody,
  type VerdictRefusalDto,
} from '@chimeres/contract';
import { Refusal, type Placement } from '@chimeres/domain';
import { messageOf } from '../../http/problem-catalogue.js';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { moveGameBodySchema, scheduleGameBodySchema } from './schedule-game-body.schema.js';

@Controller()
export class ScheduleController {
  constructor(
    @Inject(ReadSchedule) private readonly readSchedule: ReadSchedule,
    @Inject(ReadPlacements) private readonly readPlacements: ReadPlacements,
    @Inject(ScheduleGame) private readonly scheduleGame: ScheduleGame,
    @Inject(ReadMovePlacements) private readonly readMovePlacements: ReadMovePlacements,
    @Inject(MoveGame) private readonly moveGame: MoveGame,
    @Inject(UnscheduleGame) private readonly unscheduleGame: UnscheduleGame,
  ) {}

  @Get(scheduleEndpoints.read.path)
  async read(): Promise<ResponseOf<typeof scheduleEndpoints.read>> {
    return toDto(await this.readSchedule.execute());
  }

  /** Chaque case refusée porte le motif et la phrase du refus que l'écriture lèverait. */
  @Get(scheduleEndpoints.placements.path)
  async placements(
    @Param('scenarioId') scenarioId: string,
  ): Promise<ResponseOf<typeof scheduleEndpoints.placements>> {
    const placements = await this.readPlacements.execute(scenarioId);
    if (!placements) throw new Refusal('scenario-not-found', {});
    return placements.map(toPlacementDto);
  }

  /** Renvoie le programme relu. */
  @Post(scheduleEndpoints.schedule.path)
  async schedule(
    @Body(new ZodBody(scheduleGameBodySchema)) body: ScheduleGameBody,
  ): Promise<ResponseOf<typeof scheduleEndpoints.schedule>> {
    await this.scheduleGame.execute(body);
    return toDto(await this.readSchedule.execute());
  }

  /** Les verdicts de déplacement de la partie, comme ceux de la programmation. */
  @Get(scheduleEndpoints.movePlacements.path)
  async movePlacements(
    @Param('gameId') gameId: string,
  ): Promise<ResponseOf<typeof scheduleEndpoints.movePlacements>> {
    return (await this.readMovePlacements.execute(gameId)).map(toPlacementDto);
  }

  /** Renvoie le programme relu. */
  @Put(scheduleEndpoints.move.path)
  async move(
    @Param('gameId') gameId: string,
    @Body(new ZodBody(moveGameBodySchema)) body: MoveGameBody,
  ): Promise<ResponseOf<typeof scheduleEndpoints.move>> {
    await this.moveGame.execute(gameId, body);
    return toDto(await this.readSchedule.execute());
  }

  /** Renvoie le programme relu. */
  @Delete(scheduleEndpoints.unschedule.path)
  async unschedule(
    @Param('gameId') gameId: string,
  ): Promise<ResponseOf<typeof scheduleEndpoints.unschedule>> {
    await this.unscheduleGame.execute(gameId);
    return toDto(await this.readSchedule.execute());
  }
}

function toPlacementDto({ timeSlotId, tableId, refusal }: Placement) {
  return { timeSlotId, tableId, refusal: refusal && verdictOf(refusal) };
}

/** Un scénario sans créneau possible porte le motif et la phrase de son refus. */
function toDto({ games, reserve }: Schedule): ResponseOf<typeof scheduleEndpoints.read> {
  return {
    games,
    reserve: reserve.map(({ unschedulable, ...scenario }) => ({
      ...scenario,
      unschedulable: unschedulable && verdictOf(unschedulable),
    })),
  };
}

function verdictOf({ code, params }: Refusal): VerdictRefusalDto {
  return { code, ...messageOf(code, params) };
}
