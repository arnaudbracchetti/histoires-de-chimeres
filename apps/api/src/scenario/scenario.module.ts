import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  ProposeScenario,
  RemoveScenario,
  UpdateScenario,
  type ConventionRepository,
  type ScenarioRepository,
} from '@chimeres/application';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { ScenarioController } from './http/scenario.controller.js';
import { PrismaScenarioReader } from './persistence/prisma-scenario-reader.js';
import { PrismaScenarioRepository } from './persistence/prisma-scenario-repository.js';
import { SCENARIO_READER } from './scenario-reader.token.js';
import { SCENARIO_REPOSITORY } from './scenario-repository.token.js';

@Module({
  imports: [ConventionModule],
  controllers: [ScenarioController],
  providers: [
    { provide: SCENARIO_READER, useClass: PrismaScenarioReader },
    { provide: SCENARIO_REPOSITORY, useClass: PrismaScenarioRepository },
    {
      provide: ProposeScenario,
      useFactory: (conventions: ConventionRepository, scenarios: ScenarioRepository) =>
        new ProposeScenario(conventions, scenarios, randomUUID),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY],
    },
    {
      provide: UpdateScenario,
      useFactory: (scenarios: ScenarioRepository) => new UpdateScenario(scenarios),
      inject: [SCENARIO_REPOSITORY],
    },
    {
      provide: RemoveScenario,
      useFactory: (conventions: ConventionRepository, scenarios: ScenarioRepository) =>
        new RemoveScenario(conventions, scenarios),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY],
    },
  ],
  exports: [SCENARIO_REPOSITORY],
})
export class ScenarioModule {}
