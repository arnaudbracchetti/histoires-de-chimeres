import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  CancelGame,
  LaunchDraw,
  MoveParticipant,
  PublishDraw,
  ReopenSignUps,
  RerunDraw,
  RestoreGame,
} from '@chimeres/application';
import { drawEndpoints, type MoveParticipantBody } from '@chimeres/contract';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { moveParticipantBodySchema } from './move-participant-body.schema.js';

/** Les gestes du tirage rendent 204 : la page relit le suivi. */
@Controller()
export class DrawController {
  constructor(
    @Inject(LaunchDraw) private readonly launchDraw: LaunchDraw,
    @Inject(RerunDraw) private readonly rerunDraw: RerunDraw,
    @Inject(ReopenSignUps) private readonly reopenSignUps: ReopenSignUps,
    @Inject(MoveParticipant) private readonly moveParticipant: MoveParticipant,
    @Inject(PublishDraw) private readonly publishDraw: PublishDraw,
    @Inject(CancelGame) private readonly cancelGame: CancelGame,
    @Inject(RestoreGame) private readonly restoreGame: RestoreGame,
  ) {}

  @Post(drawEndpoints.launch.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async launch(@Param('timeSlotId') timeSlotId: string): Promise<void> {
    await this.launchDraw.execute(timeSlotId);
  }

  @Post(drawEndpoints.rerun.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async rerun(@Param('timeSlotId') timeSlotId: string): Promise<void> {
    await this.rerunDraw.execute(timeSlotId);
  }

  @Delete(drawEndpoints.reopenSignUps.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reopen(@Param('timeSlotId') timeSlotId: string): Promise<void> {
    await this.reopenSignUps.execute(timeSlotId);
  }

  @Put(drawEndpoints.moveParticipant.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async move(
    @Param('timeSlotId') timeSlotId: string,
    @Param('participantId') participantId: string,
    @Body(new ZodBody(moveParticipantBodySchema)) body: MoveParticipantBody,
  ): Promise<void> {
    await this.moveParticipant.execute(timeSlotId, participantId, body.gameId);
  }

  @Post(drawEndpoints.publish.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async publish(@Param('timeSlotId') timeSlotId: string): Promise<void> {
    await this.publishDraw.execute(timeSlotId);
  }

  @Put(drawEndpoints.cancelGame.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param('gameId') gameId: string): Promise<void> {
    await this.cancelGame.execute(gameId);
  }

  @Delete(drawEndpoints.restoreGame.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async restore(@Param('gameId') gameId: string): Promise<void> {
    await this.restoreGame.execute(gameId);
  }
}
