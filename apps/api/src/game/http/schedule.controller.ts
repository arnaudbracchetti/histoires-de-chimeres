import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  MoveGame,
  ReadCellPlacements,
  ReadMovePlacements,
  ReadPlacements,
  ReadSchedule,
  ReadUnscheduleVerdict,
  ScheduleGame,
  SwapGames,
  UnscheduleGame,
  type Schedule,
  type ScenarioCellPlacement,
} from '@chimeres/application';
import {
  scheduleEndpoints,
  type MoveGameBody,
  type ResponseOf,
  type ScheduleGameBody,
  type SwapGamesBody,
} from '@chimeres/contract';
import { Refusal, type MovePlacement, type Placement } from '@chimeres/domain';
import { verdictOf } from '../../http/problem-catalogue.js';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { toReserveDto } from './reserve-dto.js';
import {
  moveGameBodySchema,
  scheduleGameBodySchema,
  swapGamesBodySchema,
} from './schedule-game-body.schema.js';

@Controller()
export class ScheduleController {
  constructor(
    @Inject(ReadSchedule) private readonly readSchedule: ReadSchedule,
    @Inject(ReadPlacements) private readonly readPlacements: ReadPlacements,
    @Inject(ReadCellPlacements) private readonly readCellPlacements: ReadCellPlacements,
    @Inject(ScheduleGame) private readonly scheduleGame: ScheduleGame,
    @Inject(ReadMovePlacements) private readonly readMovePlacements: ReadMovePlacements,
    @Inject(MoveGame) private readonly moveGame: MoveGame,
    @Inject(SwapGames) private readonly swapGames: SwapGames,
    @Inject(ReadUnscheduleVerdict) private readonly readUnscheduleVerdict: ReadUnscheduleVerdict,
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

  /**
   * Les verdicts de la case pour chaque scénario sans partie qui commence sur le créneau : les
   * programmables d'abord, les autres avec le motif et la phrase de leur refus.
   */
  @Get(scheduleEndpoints.cellPlacements.path)
  async cellPlacements(
    @Param('timeSlotId') timeSlotId: string,
    @Param('tableId') tableId: string,
  ): Promise<ResponseOf<typeof scheduleEndpoints.cellPlacements>> {
    return (await this.readCellPlacements.execute(timeSlotId, tableId)).map(toCellPlacementDto);
  }

  /** Renvoie le programme relu. */
  @Post(scheduleEndpoints.schedule.path)
  async schedule(
    @Body(new ZodBody(scheduleGameBodySchema)) body: ScheduleGameBody,
  ): Promise<ResponseOf<typeof scheduleEndpoints.schedule>> {
    await this.scheduleGame.execute(body);
    return toDto(await this.readSchedule.execute());
  }

  /** Les verdicts de déplacement ou d'échange de la partie, comme ceux de la programmation. */
  @Get(scheduleEndpoints.movePlacements.path)
  async movePlacements(
    @Param('gameId') gameId: string,
  ): Promise<ResponseOf<typeof scheduleEndpoints.movePlacements>> {
    return (await this.readMovePlacements.execute(gameId)).map(toMovePlacementDto);
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

  /** Renvoie le programme relu : rien n'est créé, d'où 200. */
  @Post(scheduleEndpoints.swap.path)
  @HttpCode(HttpStatus.OK)
  async swap(
    @Param('gameId') gameId: string,
    @Body(new ZodBody(swapGamesBodySchema)) body: SwapGamesBody,
  ): Promise<ResponseOf<typeof scheduleEndpoints.swap>> {
    await this.swapGames.execute(gameId, body);
    return toDto(await this.readSchedule.execute());
  }

  /** Les inscriptions que la déprogrammation de la partie retirerait. */
  @Get(scheduleEndpoints.unscheduleVerdict.path)
  async unscheduleVerdict(
    @Param('gameId') gameId: string,
  ): Promise<ResponseOf<typeof scheduleEndpoints.unscheduleVerdict>> {
    return this.readUnscheduleVerdict.execute(gameId);
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

function toCellPlacementDto({ scenario, refusal }: ScenarioCellPlacement) {
  return { scenario, refusal: refusal && verdictOf(refusal) };
}

function toMovePlacementDto({ swapWith, removedSignUps, ...placement }: MovePlacement) {
  return { ...toPlacementDto(placement), swapWith, removedSignUps };
}

function toDto({ games, reserve }: Schedule): ResponseOf<typeof scheduleEndpoints.read> {
  return { games, reserve: toReserveDto(reserve) };
}
