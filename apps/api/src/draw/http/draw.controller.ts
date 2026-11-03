import { Controller, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { LaunchDraw } from '@chimeres/application';
import { drawEndpoints } from '@chimeres/contract';

/** Les gestes du tirage rendent 204 : la page relit le suivi. */
@Controller()
export class DrawController {
  constructor(@Inject(LaunchDraw) private readonly launchDraw: LaunchDraw) {}

  @Post(drawEndpoints.launch.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async launch(@Param('timeSlotId') timeSlotId: string): Promise<void> {
    await this.launchDraw.execute(timeSlotId);
  }
}
