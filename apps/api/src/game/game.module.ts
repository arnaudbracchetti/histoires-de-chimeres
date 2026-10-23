import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  ReadPlacements,
  ReadSchedule,
  ScheduleGame,
  type ConventionRepository,
  type ScenarioRepository,
  type ScheduleReader,
} from '@chimeres/application';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { SCENARIO_REPOSITORY } from '../scenario/scenario-repository.token.js';
import { ScenarioModule } from '../scenario/scenario.module.js';
import { ScheduleController } from './http/schedule.controller.js';
import { PrismaScheduleReader } from './persistence/prisma-schedule-reader.js';
import { SCHEDULE_READER } from './schedule-reader.token.js';

@Module({
  imports: [ConventionModule, ScenarioModule],
  controllers: [ScheduleController],
  providers: [
    { provide: SCHEDULE_READER, useClass: PrismaScheduleReader },
    {
      provide: ReadSchedule,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        reader: ScheduleReader,
      ) => new ReadSchedule(conventions, scenarios, reader),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, SCHEDULE_READER],
    },
    {
      provide: ReadPlacements,
      useFactory: (conventions: ConventionRepository, scenarios: ScenarioRepository) =>
        new ReadPlacements(conventions, scenarios),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY],
    },
    {
      provide: ScheduleGame,
      useFactory: (conventions: ConventionRepository, scenarios: ScenarioRepository) =>
        new ScheduleGame(conventions, scenarios, randomUUID),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY],
    },
  ],
})
export class GameModule {}
