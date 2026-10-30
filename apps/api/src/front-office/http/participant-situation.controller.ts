import { Controller, Get, Inject, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ReadParticipantSituation } from '@chimeres/application';
import { frontOfficeEndpoints, type ResponseOf } from '@chimeres/contract';
import { linkedPhoneIdOf } from './linked-phone-cookie.js';

/** La situation du pseudo, lue avec le programme par chaque téléphone relié (ADR 0011). */
@Controller()
export class ParticipantSituationController {
  constructor(
    @Inject(ReadParticipantSituation) private readonly readSituation: ReadParticipantSituation,
  ) {}

  @Get(frontOfficeEndpoints.readSituation.path)
  read(@Req() request: Request): Promise<ResponseOf<typeof frontOfficeEndpoints.readSituation>> {
    return this.readSituation.execute(linkedPhoneIdOf(request));
  }
}
