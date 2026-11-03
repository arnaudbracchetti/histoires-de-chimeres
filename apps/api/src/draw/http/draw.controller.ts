import { Controller, Delete, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { LaunchDraw, ReopenSignUps, RerunDraw } from '@chimeres/application';
import { drawEndpoints } from '@chimeres/contract';

/** Les gestes du tirage rendent 204 : la page relit le suivi. */
@Controller()
export class DrawController {
  constructor(
    @Inject(LaunchDraw) private readonly launchDraw: LaunchDraw,
    @Inject(RerunDraw) private readonly rerunDraw: RerunDraw,
    @Inject(ReopenSignUps) private readonly reopenSignUps: ReopenSignUps,
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
}
