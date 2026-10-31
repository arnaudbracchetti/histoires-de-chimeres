import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  MoveGame,
  ReadMovePlacements,
  ReadPlacements,
  ReadSchedule,
  ScheduleGame,
  SwapGames,
  UnscheduleGame,
  type ConventionRepository,
  type NotificationSender,
  type ScenarioRepository,
  type ScheduleReader,
} from '@chimeres/application';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { NOTIFICATION_SENDER } from '../notification/notification-sender.token.js';
import { NotificationModule } from '../notification/notification.module.js';
import { SCENARIO_REPOSITORY } from '../scenario/scenario-repository.token.js';
import { ScenarioModule } from '../scenario/scenario.module.js';
import { ScheduleController } from './http/schedule.controller.js';
import { PrismaScheduleReader } from './persistence/prisma-schedule-reader.js';
import { SCHEDULE_READER } from './schedule-reader.token.js';

@Module({
  imports: [ConventionModule, NotificationModule, ScenarioModule],
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
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        notifications: NotificationSender,
      ) => new ScheduleGame(conventions, scenarios, notifications, randomUUID),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, NOTIFICATION_SENDER],
    },
    {
      provide: ReadMovePlacements,
      useFactory: (conventions: ConventionRepository) => new ReadMovePlacements(conventions),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: MoveGame,
      useFactory: (conventions: ConventionRepository, notifications: NotificationSender) =>
        new MoveGame(conventions, notifications),
      inject: [CONVENTION_REPOSITORY, NOTIFICATION_SENDER],
    },
    {
      provide: SwapGames,
      useFactory: (conventions: ConventionRepository, notifications: NotificationSender) =>
        new SwapGames(conventions, notifications),
      inject: [CONVENTION_REPOSITORY, NOTIFICATION_SENDER],
    },
    {
      provide: UnscheduleGame,
      useFactory: (conventions: ConventionRepository, notifications: NotificationSender) =>
        new UnscheduleGame(conventions, notifications),
      inject: [CONVENTION_REPOSITORY, NOTIFICATION_SENDER],
    },
  ],
})
export class GameModule {}
