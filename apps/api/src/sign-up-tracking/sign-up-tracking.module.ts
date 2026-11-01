import { Module } from '@nestjs/common';
import {
  ReadSignUpTracking,
  type ConventionRepository,
  type ScenarioRepository,
} from '@chimeres/application';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { SCENARIO_REPOSITORY } from '../scenario/scenario-repository.token.js';
import { ScenarioModule } from '../scenario/scenario.module.js';
import { SignUpTrackingController } from './http/sign-up-tracking.controller.js';

@Module({
  imports: [ConventionModule, ScenarioModule],
  controllers: [SignUpTrackingController],
  providers: [
    {
      provide: ReadSignUpTracking,
      useFactory: (conventions: ConventionRepository, scenarios: ScenarioRepository) =>
        new ReadSignUpTracking(conventions, scenarios),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY],
    },
  ],
})
export class SignUpTrackingModule {}
