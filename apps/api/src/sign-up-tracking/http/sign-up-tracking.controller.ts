import { Controller, Get, Inject } from '@nestjs/common';
import { ReadSignUpTracking, type SignUpTracking } from '@chimeres/application';
import { signUpTrackingEndpoints, type ResponseOf } from '@chimeres/contract';
import { toReserveDto } from '../../game/http/reserve-dto.js';
import { verdictOf } from '../../http/problem-catalogue.js';
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
 * Chaque avertissement de suivi porte son titre et son détail, et chaque motif, de la réserve d'un
 * créneau comme de la réserve, le titre et la phrase de son refus.
 */
function toDto({
  timeSlots,
  reserve,
  ...tracking
}: SignUpTracking): ResponseOf<typeof signUpTrackingEndpoints.read> {
  return {
    ...tracking,
    timeSlots: timeSlots.map((slot) => ({
      ...slot,
      warnings: slot.warnings.map(writeSignUpWarning),
      reserve: slot.reserve.map(({ scenarioId, refusal }) => ({
        scenarioId,
        refusal: refusal && verdictOf(refusal),
      })),
    })),
    reserve: toReserveDto(reserve),
  };
}
