import { Module } from '@nestjs/common';
import {
  CancelGame,
  LaunchDraw,
  MoveParticipant,
  PublishDraw,
  ReopenSignUps,
  RerunDraw,
  RestoreGame,
  type ConventionRepository,
  type NotificationSender,
  type ScenarioRepository,
} from '@chimeres/application';
import type { DrawAlgorithm, RandomSource } from '@chimeres/domain';
import { ExhaustiveDrawAlgorithm } from '@chimeres/draw';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { SCENARIO_REPOSITORY } from '../scenario/scenario-repository.token.js';
import { ScenarioModule } from '../scenario/scenario.module.js';
import { cryptoRandom } from './crypto-random.js';
import { DRAW_ALGORITHM } from './draw-algorithm.token.js';
import { NOTIFICATION_SENDER } from '../notification/notification-sender.token.js';
import { NotificationModule } from '../notification/notification.module.js';
import { DrawController } from './http/draw.controller.js';
import { RANDOM_SOURCE } from './random-source.token.js';

/** Les gestes du tirage. Un seul algorithme est actif, choisi ici (ADR 0014). */
@Module({
  imports: [ConventionModule, NotificationModule, ScenarioModule],
  controllers: [DrawController],
  providers: [
    { provide: DRAW_ALGORITHM, useValue: new ExhaustiveDrawAlgorithm() },
    { provide: RANDOM_SOURCE, useValue: cryptoRandom },
    {
      provide: LaunchDraw,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        algorithm: DrawAlgorithm,
        random: RandomSource,
      ) => new LaunchDraw(conventions, scenarios, algorithm, random),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, DRAW_ALGORITHM, RANDOM_SOURCE],
    },
    {
      provide: RerunDraw,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        algorithm: DrawAlgorithm,
        random: RandomSource,
      ) => new RerunDraw(conventions, scenarios, algorithm, random),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, DRAW_ALGORITHM, RANDOM_SOURCE],
    },
    {
      provide: ReopenSignUps,
      useFactory: (conventions: ConventionRepository) => new ReopenSignUps(conventions),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: MoveParticipant,
      useFactory: (conventions: ConventionRepository) => new MoveParticipant(conventions),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: PublishDraw,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        notifications: NotificationSender,
      ) => new PublishDraw(conventions, scenarios, notifications),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, NOTIFICATION_SENDER],
    },
    {
      provide: CancelGame,
      useFactory: (conventions: ConventionRepository, scenarios: ScenarioRepository) =>
        new CancelGame(conventions, scenarios),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY],
    },
    {
      provide: RestoreGame,
      useFactory: (conventions: ConventionRepository) => new RestoreGame(conventions),
      inject: [CONVENTION_REPOSITORY],
    },
  ],
})
export class DrawModule {}
