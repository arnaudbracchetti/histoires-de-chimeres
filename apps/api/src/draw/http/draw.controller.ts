import { Controller, Delete, HttpCode, HttpStatus, Inject, Param, Post, Put } from '@nestjs/common';
import {
  CancelGame,
  LaunchDraw,
  ReopenSignUps,
  RerunDraw,
  RestoreGame,
} from '@chimeres/application';
import { drawEndpoints } from '@chimeres/contract';

/** Les gestes du tirage rendent 204 : la page relit le suivi. */
@Controller()
export class DrawController {
  constructor(
    @Inject(LaunchDraw) private readonly launchDraw: LaunchDraw,
    @Inject(RerunDraw) private readonly rerunDraw: RerunDraw,
    @Inject(ReopenSignUps) private readonly reopenSignUps: ReopenSignUps,
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
