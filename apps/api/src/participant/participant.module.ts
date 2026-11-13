import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  AddLatecomerToPublishedDraw,
  AppointRole,
  AddParticipant,
  MergeParticipant,
  ReadMergeVerdict,
  ReadParticipantList,
  ReadParticipantSheet,
  RemoveParticipant,
  RenameParticipant,
  UnlinkParticipantPhones,
  SignUpParticipantForGame,
  WithdrawParticipantFromDraw,
  WithdrawParticipantFromGame,
  WithdrawRole,
  type AccountRepository,
  type Clock,
  type ConventionRepository,
  type LinkedPhoneRepository,
  type NotificationSender,
  type ParticipantReader,
  type ScenarioRepository,
  type ScheduleReader,
} from '@chimeres/application';
import { ACCOUNT_REPOSITORY } from '../account/account-repository.token.js';
import { AccountModule } from '../account/account.module.js';
import { CLOCK } from '../clock/clock.token.js';
import { ParisClock } from '../clock/paris-clock.js';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { LINKED_PHONE_REPOSITORY } from '../front-office/linked-phone-repository.token.js';
import { PrismaLinkedPhoneRepository } from '../front-office/persistence/prisma-linked-phone-repository.js';
import { NOTIFICATION_SENDER } from '../notification/notification-sender.token.js';
import { NotificationModule } from '../notification/notification.module.js';
import { SCHEDULE_READER } from '../game/schedule-reader.token.js';
import { GameModule } from '../game/game.module.js';
import { SCENARIO_REPOSITORY } from '../scenario/scenario-repository.token.js';
import { ScenarioModule } from '../scenario/scenario.module.js';
import { ParticipantController } from './http/participant.controller.js';
import { PARTICIPANT_READER } from './participant-reader.token.js';
import { PrismaParticipantReader } from './persistence/prisma-participant-reader.js';

@Module({
  imports: [AccountModule, ConventionModule, GameModule, NotificationModule, ScenarioModule],
  controllers: [ParticipantController],
  providers: [
    { provide: CLOCK, useClass: ParisClock },
    { provide: PARTICIPANT_READER, useClass: PrismaParticipantReader },
    { provide: LINKED_PHONE_REPOSITORY, useClass: PrismaLinkedPhoneRepository },
    {
      provide: AddParticipant,
      useFactory: (repository: ConventionRepository) => new AddParticipant(repository, randomUUID),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: RenameParticipant,
      useFactory: (repository: ConventionRepository) => new RenameParticipant(repository),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: RemoveParticipant,
      useFactory: (repository: ConventionRepository) => new RemoveParticipant(repository),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: MergeParticipant,
      useFactory: (repository: ConventionRepository) => new MergeParticipant(repository),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: ReadMergeVerdict,
      useFactory: (conventions: ConventionRepository, schedule: ScheduleReader) =>
        new ReadMergeVerdict(conventions, schedule),
      inject: [CONVENTION_REPOSITORY, SCHEDULE_READER],
    },
    {
      provide: SignUpParticipantForGame,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        notifications: NotificationSender,
      ) => new SignUpParticipantForGame(conventions, scenarios, notifications),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, NOTIFICATION_SENDER],
    },
    {
      provide: WithdrawParticipantFromGame,
      useFactory: (conventions: ConventionRepository) =>
        new WithdrawParticipantFromGame(conventions),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: WithdrawParticipantFromDraw,
      useFactory: (conventions: ConventionRepository) =>
        new WithdrawParticipantFromDraw(conventions),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: AddLatecomerToPublishedDraw,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        notifications: NotificationSender,
        clock: Clock,
      ) => new AddLatecomerToPublishedDraw(conventions, scenarios, notifications, clock),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, NOTIFICATION_SENDER, CLOCK],
    },
    {
      provide: UnlinkParticipantPhones,
      useFactory: (conventions: ConventionRepository, phones: LinkedPhoneRepository) =>
        new UnlinkParticipantPhones(conventions, phones),
      inject: [CONVENTION_REPOSITORY, LINKED_PHONE_REPOSITORY],
    },
    {
      provide: ReadParticipantList,
      useFactory: (
        conventions: ConventionRepository,
        reader: ParticipantReader,
        clock: Clock,
        accounts: AccountRepository,
      ) => new ReadParticipantList(conventions, reader, clock, accounts),
      inject: [CONVENTION_REPOSITORY, PARTICIPANT_READER, CLOCK, ACCOUNT_REPOSITORY],
    },
    {
      provide: ReadParticipantSheet,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        schedule: ScheduleReader,
        reader: ParticipantReader,
        clock: Clock,
        accounts: AccountRepository,
      ) => new ReadParticipantSheet(conventions, scenarios, schedule, reader, clock, accounts),
      inject: [
        CONVENTION_REPOSITORY,
        SCENARIO_REPOSITORY,
        SCHEDULE_READER,
        PARTICIPANT_READER,
        CLOCK,
        ACCOUNT_REPOSITORY,
      ],
    },
    {
      provide: AppointRole,
      useFactory: (conventions: ConventionRepository, accounts: AccountRepository) =>
        new AppointRole(conventions, accounts, randomUUID),
      inject: [CONVENTION_REPOSITORY, ACCOUNT_REPOSITORY],
    },
    {
      provide: WithdrawRole,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        accounts: AccountRepository,
      ) => new WithdrawRole(conventions, scenarios, accounts),
      inject: [CONVENTION_REPOSITORY, SCENARIO_REPOSITORY, ACCOUNT_REPOSITORY],
    },
  ],
})
export class ParticipantModule {}
