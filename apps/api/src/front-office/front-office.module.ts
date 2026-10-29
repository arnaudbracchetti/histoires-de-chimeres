import { randomBytes, randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  Identify,
  ReadFrontOffice,
  ReadFrontOfficeSchedule,
  ReadLinkedPhone,
  UnlinkPhone,
  VerifyPresenceCode,
  type Clock,
  type ConventionRepository,
  type FrontOfficeScheduleReader,
  type LinkedPhoneReader,
  type LinkedPhoneRepository,
} from '@chimeres/application';
import { CLOCK } from '../clock/clock.token.js';
import { ParisClock } from '../clock/paris-clock.js';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { FRONT_OFFICE_SCHEDULE_READER } from './front-office-schedule-reader.token.js';
import { FrontOfficeScheduleController } from './http/front-office-schedule.controller.js';
import { FrontOfficeController } from './http/front-office.controller.js';
import { LinkedPhoneController } from './http/linked-phone.controller.js';
import { LINKED_PHONE_READER } from './linked-phone-reader.token.js';
import { LINKED_PHONE_REPOSITORY } from './linked-phone-repository.token.js';
import { PrismaFrontOfficeScheduleReader } from './persistence/prisma-front-office-schedule-reader.js';
import { PrismaLinkedPhoneReader } from './persistence/prisma-linked-phone-reader.js';
import { PrismaLinkedPhoneRepository } from './persistence/prisma-linked-phone-repository.js';
import { PresenceCodeAttempts } from './presence-code-attempts.js';

/** L'identifiant opaque d'un téléphone relié, valeur de son cookie : 256 bits tirés au hasard. */
const newPhoneId = () => randomBytes(32).toString('base64url');

@Module({
  imports: [ConventionModule],
  controllers: [FrontOfficeController, FrontOfficeScheduleController, LinkedPhoneController],
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
      provide: Identify,
      useFactory: (
        conventions: ConventionRepository,
        phones: LinkedPhoneRepository,
        clock: Clock,
      ) => new Identify(conventions, phones, clock, randomUUID, newPhoneId),
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
