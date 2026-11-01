import { Controller, Get, Inject } from '@nestjs/common';
import { ReadSignUpTracking, type SignUpTracking } from '@chimeres/application';
import { signUpTrackingEndpoints, type ResponseOf } from '@chimeres/contract';
import { toReserveDto } from '../../game/http/reserve-dto.js';
import { verdictOf } from '../../http/problem-catalogue.js';

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

/** Chaque motif, de la réserve d'un créneau comme de la réserve, porte le titre et la phrase de son refus. */
function toDto({
  timeSlots,
  reserve,
  ...tracking
}: SignUpTracking): ResponseOf<typeof signUpTrackingEndpoints.read> {
  return {
    ...tracking,
    timeSlots: timeSlots.map((slot) => ({
      ...slot,
      reserve: slot.reserve.map(({ scenarioId, refusal }) => ({
        scenarioId,
        refusal: refusal && verdictOf(refusal),
      })),
    })),
    reserve: toReserveDto(reserve),
  };
}
