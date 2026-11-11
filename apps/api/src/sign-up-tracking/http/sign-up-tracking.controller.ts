import { Controller, Get, Inject } from '@nestjs/common';
import { ReadSignUpTracking, type SignUpTracking } from '@chimeres/application';
import { signUpTrackingEndpoints, type ResponseOf } from '@chimeres/contract';
import { toReserveDto } from '../../game/http/reserve-dto.js';
import { writeDrawSignal } from '../../http/draw-signal-catalogue.js';
import { buildVerdictRefusal } from '../../http/problem-catalogue.js';
import { writeSignUpWarning } from '../../http/sign-up-warning-catalogue.js';

@Controller()
export class SignUpTrackingController {
  constructor(
    @Inject(ReadSignUpTracking) private readonly readSignUpTracking: ReadSignUpTracking,
  ) {}

  @Get(signUpTrackingEndpoints.read.path)
  async read(): Promise<ResponseOf<typeof signUpTrackingEndpoints.read>> {
    return toDto(await this.readSignUpTracking.execute());
  }
}

/**
 * Chaque avertissement de suivi et chaque signal du tirage porte son titre et son détail, et chaque
 * motif, de la réserve d'un créneau comme de la réserve, le titre et la phrase de son refus.
 */
function toDto({
  timeSlots,
  reserve,
  ...tracking
}: SignUpTracking): ResponseOf<typeof signUpTrackingEndpoints.read> {
  const titles = new Map(tracking.games.map(({ id, scenario }) => [id, scenario.title]));
  const titleOfGame = (gameId: string) => titles.get(gameId)!;
  return {
    ...tracking,
    timeSlots: timeSlots.map((slot) => ({
      ...slot,
      warnings: slot.warnings.map(writeSignUpWarning),
      draw: slot.draw && {
        ...slot.draw,
        signals: slot.draw.signals.map((signal) => writeDrawSignal(signal, titleOfGame)),
      },
      reserve: slot.reserve.map(({ scenarioId, refusal }) => ({
        scenarioId,
        refusal: refusal && buildVerdictRefusal(refusal),
      })),
    })),
    reserve: toReserveDto(reserve),
  };
}
