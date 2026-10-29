import { Controller, Get, Inject, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ReadFrontOfficeSchedule } from '@chimeres/application';
import { frontOfficeEndpoints, type ResponseOf } from '@chimeres/contract';
import { linkedPhoneIdOf } from './linked-phone-cookie.js';

/** Le programme du front office, lu toutes les 30 s par chaque téléphone relié (ADR 0011). */
@Controller()
export class FrontOfficeScheduleController {
  constructor(
    @Inject(ReadFrontOfficeSchedule) private readonly readSchedule: ReadFrontOfficeSchedule,
  ) {}

  @Get(frontOfficeEndpoints.readSchedule.path)
  read(@Req() request: Request): Promise<ResponseOf<typeof frontOfficeEndpoints.readSchedule>> {
    return this.readSchedule.execute(linkedPhoneIdOf(request));
  }
}
