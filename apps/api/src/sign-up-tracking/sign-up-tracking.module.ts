import { Module } from '@nestjs/common';
import {
  ReadSignUpTracking,
  type ConventionRepository,
  type ScenarioRepository,
  type ScheduleReader,
} from '@chimeres/application';
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
    {
      provide: ReadSignUpTracking,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        reader: ScheduleReader,
      ) => new ReadSignUpTracking(conventions, scenarios, reader),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, SCHEDULE_READER],
    },
  ],
})
export class SignUpTrackingModule {}
