import { Module } from '@nestjs/common';
import {
  ReadSignUpTracking,
  type Clock,
  type ConventionRepository,
  type ScenarioRepository,
  type ScheduleReader,
} from '@chimeres/application';
import { CLOCK } from '../clock/clock.token.js';
import { ParisClock } from '../clock/paris-clock.js';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { GameModule } from '../game/game.module.js';
import { SCHEDULE_READER } from '../game/schedule-reader.token.js';
import { SCENARIO_REPOSITORY } from '../scenario/scenario-repository.token.js';
import { ScenarioModule } from '../scenario/scenario.module.js';
import { SignUpTrackingController } from './http/sign-up-tracking.controller.js';

@Module({
  imports: [ConventionModule, GameModule, ScenarioModule],
  controllers: [SignUpTrackingController],
  providers: [
    { provide: CLOCK, useClass: ParisClock },
    {
      provide: ReadSignUpTracking,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        reader: ScheduleReader,
        clock: Clock,
      ) => new ReadSignUpTracking(conventions, scenarios, reader, clock),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, SCHEDULE_READER, CLOCK],
    },
  ],
})
export class SignUpTrackingModule {}
