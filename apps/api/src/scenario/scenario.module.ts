import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  ChangeScenarioImage,
  ProposeScenario,
  RemoveScenarioImage,
  RemoveScenario,
  UpdateScenario,
  type ConventionRepository,
  type ImageProcessor,
  type NotificationSender,
  type ScenarioImageRepository,
  type ScenarioRepository,
} from '@chimeres/application';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { NOTIFICATION_SENDER } from '../notification/notification-sender.token.js';
import { NotificationModule } from '../notification/notification.module.js';
import { ScenarioImageController } from './http/scenario-image.controller.js';
import { ScenarioController } from './http/scenario.controller.js';
import { SharpImageProcessor } from './image/sharp-image-processor.js';
import { IMAGE_PROCESSOR } from './image-processor.token.js';
import { PrismaScenarioImageReader } from './persistence/prisma-scenario-image-reader.js';
import { PrismaScenarioImageRepository } from './persistence/prisma-scenario-image-repository.js';
import { PrismaScenarioReader } from './persistence/prisma-scenario-reader.js';
import { PrismaScenarioRepository } from './persistence/prisma-scenario-repository.js';
import { SCENARIO_IMAGE_READER } from './scenario-image-reader.token.js';
import { SCENARIO_IMAGE_REPOSITORY } from './scenario-image-repository.token.js';
import { SCENARIO_READER } from './scenario-reader.token.js';
import { SCENARIO_REPOSITORY } from './scenario-repository.token.js';

@Module({
  imports: [ConventionModule, NotificationModule],
  controllers: [ScenarioController, ScenarioImageController],
  providers: [
    { provide: SCENARIO_READER, useClass: PrismaScenarioReader },
    { provide: SCENARIO_REPOSITORY, useClass: PrismaScenarioRepository },
    { provide: SCENARIO_IMAGE_READER, useClass: PrismaScenarioImageReader },
    { provide: SCENARIO_IMAGE_REPOSITORY, useClass: PrismaScenarioImageRepository },
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessor },
    {
      provide: ProposeScenario,
      useFactory: (conventions: ConventionRepository, scenarios: ScenarioRepository) =>
        new ProposeScenario(conventions, scenarios, randomUUID),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY],
    },
    {
      provide: UpdateScenario,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        notifications: NotificationSender,
      ) => new UpdateScenario(conventions, scenarios, notifications),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, NOTIFICATION_SENDER],
    },
    {
      provide: RemoveScenario,
      useFactory: (conventions: ConventionRepository, scenarios: ScenarioRepository) =>
        new RemoveScenario(conventions, scenarios),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY],
    },
    {
      provide: ChangeScenarioImage,
      useFactory: (
        scenarios: ScenarioRepository,
        processor: ImageProcessor,
        images: ScenarioImageRepository,
      ) => new ChangeScenarioImage(scenarios, processor, images, randomUUID),
      inject: [SCENARIO_REPOSITORY, IMAGE_PROCESSOR, SCENARIO_IMAGE_REPOSITORY],
    },
    {
      provide: RemoveScenarioImage,
      useFactory: (scenarios: ScenarioRepository, images: ScenarioImageRepository) =>
        new RemoveScenarioImage(scenarios, images),
      inject: [SCENARIO_REPOSITORY, SCENARIO_IMAGE_REPOSITORY],
    },
  ],
  exports: [SCENARIO_REPOSITORY],
})
export class ScenarioModule {}
