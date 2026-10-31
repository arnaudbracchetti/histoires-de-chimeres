import { randomBytes, randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  Identify,
  ReadFrontOffice,
  ReadFrontOfficeSchedule,
  ReadLinkedPhone,
  ReadParticipantSituation,
  SavePushSubscription,
  SignUpForGame,
  UnlinkPhone,
  WithdrawFromGame,
  VerifyPresenceCode,
  type Clock,
  type ConventionRepository,
  type FrontOfficeScheduleReader,
  type LinkedPhoneReader,
  type LinkedPhoneRepository,
  type NotificationSender,
  type ScenarioRepository,
} from '@chimeres/application';
import { CLOCK } from '../clock/clock.token.js';
import { ParisClock } from '../clock/paris-clock.js';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { NOTIFICATION_SENDER } from '../notification/notification-sender.token.js';
import { NotificationModule } from '../notification/notification.module.js';
import { SCENARIO_REPOSITORY } from '../scenario/scenario-repository.token.js';
import { ScenarioModule } from '../scenario/scenario.module.js';
import { FRONT_OFFICE_SCHEDULE_READER } from './front-office-schedule-reader.token.js';
import { FrontOfficeScheduleController } from './http/front-office-schedule.controller.js';
import { FrontOfficeController } from './http/front-office.controller.js';
import { LinkedPhoneController } from './http/linked-phone.controller.js';
import { ParticipantSituationController } from './http/participant-situation.controller.js';
import { PushSubscriptionController } from './http/push-subscription.controller.js';
import { SignUpController } from './http/sign-up.controller.js';
import { LINKED_PHONE_READER } from './linked-phone-reader.token.js';
import { LINKED_PHONE_REPOSITORY } from './linked-phone-repository.token.js';
import { PrismaFrontOfficeScheduleReader } from './persistence/prisma-front-office-schedule-reader.js';
import { PrismaLinkedPhoneReader } from './persistence/prisma-linked-phone-reader.js';
import { PrismaLinkedPhoneRepository } from './persistence/prisma-linked-phone-repository.js';
import { PresenceCodeAttempts } from './presence-code-attempts.js';

/** L'identifiant opaque d'un téléphone relié, valeur de son cookie : 256 bits tirés au hasard. */
const newPhoneId = () => randomBytes(32).toString('base64url');

@Module({
  imports: [ConventionModule, NotificationModule, ScenarioModule],
  controllers: [
    FrontOfficeController,
    FrontOfficeScheduleController,
    LinkedPhoneController,
    ParticipantSituationController,
    PushSubscriptionController,
    SignUpController,
  ],
  providers: [
    { provide: CLOCK, useClass: ParisClock },
    { provide: LINKED_PHONE_REPOSITORY, useClass: PrismaLinkedPhoneRepository },
    { provide: LINKED_PHONE_READER, useClass: PrismaLinkedPhoneReader },
    { provide: FRONT_OFFICE_SCHEDULE_READER, useClass: PrismaFrontOfficeScheduleReader },
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
    {
      provide: ReadLinkedPhone,
      useFactory: (conventions: ConventionRepository, reader: LinkedPhoneReader, clock: Clock) =>
        new ReadLinkedPhone(conventions, reader, clock),
      inject: [CONVENTION_REPOSITORY, LINKED_PHONE_READER, CLOCK],
    },
    {
      provide: ReadFrontOfficeSchedule,
      useFactory: (
        conventions: ConventionRepository,
        phones: LinkedPhoneReader,
        schedule: FrontOfficeScheduleReader,
        clock: Clock,
      ) => new ReadFrontOfficeSchedule(conventions, phones, schedule, clock),
      inject: [CONVENTION_REPOSITORY, LINKED_PHONE_READER, FRONT_OFFICE_SCHEDULE_READER, CLOCK],
    },
    {
      provide: ReadParticipantSituation,
      useFactory: (
        conventions: ConventionRepository,
        phones: LinkedPhoneRepository,
        clock: Clock,
      ) => new ReadParticipantSituation(conventions, phones, clock),
      inject: [CONVENTION_REPOSITORY, LINKED_PHONE_REPOSITORY, CLOCK],
    },
    {
      provide: SignUpForGame,
      useFactory: (
        conventions: ConventionRepository,
        phones: LinkedPhoneRepository,
        scenarios: ScenarioRepository,
        notifications: NotificationSender,
        clock: Clock,
      ) => new SignUpForGame(conventions, phones, scenarios, notifications, clock),
      inject: [
        CONVENTION_REPOSITORY,
        LINKED_PHONE_REPOSITORY,
        SCENARIO_REPOSITORY,
        NOTIFICATION_SENDER,
        CLOCK,
      ],
    },
    {
      provide: WithdrawFromGame,
      useFactory: (
        conventions: ConventionRepository,
        phones: LinkedPhoneRepository,
        clock: Clock,
      ) => new WithdrawFromGame(conventions, phones, clock),
      inject: [CONVENTION_REPOSITORY, LINKED_PHONE_REPOSITORY, CLOCK],
    },
    {
      provide: Identify,
      useFactory: (
        conventions: ConventionRepository,
        phones: LinkedPhoneRepository,
        clock: Clock,
      ) => new Identify(conventions, phones, clock, randomUUID, newPhoneId),
      inject: [CONVENTION_REPOSITORY, LINKED_PHONE_REPOSITORY, CLOCK],
    },
    {
      provide: SavePushSubscription,
      useFactory: (
        conventions: ConventionRepository,
        phones: LinkedPhoneRepository,
        clock: Clock,
      ) => new SavePushSubscription(conventions, phones, clock),
      inject: [CONVENTION_REPOSITORY, LINKED_PHONE_REPOSITORY, CLOCK],
    },
    {
      provide: UnlinkPhone,
      useFactory: (
        conventions: ConventionRepository,
        phones: LinkedPhoneRepository,
        clock: Clock,
      ) => new UnlinkPhone(conventions, phones, clock),
      inject: [CONVENTION_REPOSITORY, LINKED_PHONE_REPOSITORY, CLOCK],
    },
  ],
})
export class FrontOfficeModule {}
