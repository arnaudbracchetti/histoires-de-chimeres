import { Module } from '@nestjs/common';
import {
  ReadFrontOffice,
  VerifyPresenceCode,
  type Clock,
  type ConventionRepository,
} from '@chimeres/application';
import { CLOCK } from '../clock/clock.token.js';
import { ParisClock } from '../clock/paris-clock.js';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { FrontOfficeController } from './http/front-office.controller.js';
import { PresenceCodeAttempts } from './presence-code-attempts.js';

@Module({
  imports: [ConventionModule],
  controllers: [FrontOfficeController],
  providers: [
    { provide: CLOCK, useClass: ParisClock },
    PresenceCodeAttempts,
    {
      provide: ReadFrontOffice,
      useFactory: (repository: ConventionRepository, clock: Clock) =>
        new ReadFrontOffice(repository, clock),
      inject: [CONVENTION_REPOSITORY, CLOCK],
    },
    {
      provide: VerifyPresenceCode,
      useFactory: (repository: ConventionRepository, clock: Clock) =>
        new VerifyPresenceCode(repository, clock),
      inject: [CONVENTION_REPOSITORY, CLOCK],
    },
  ],
})
export class FrontOfficeModule {}
