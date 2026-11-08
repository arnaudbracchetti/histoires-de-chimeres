import { Module } from '@nestjs/common';
import {
  ReadParticipantList,
  type Clock,
  type ConventionRepository,
  type ParticipantReader,
} from '@chimeres/application';
import { CLOCK } from '../clock/clock.token.js';
import { ParisClock } from '../clock/paris-clock.js';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { ParticipantController } from './http/participant.controller.js';
import { PARTICIPANT_READER } from './participant-reader.token.js';
import { PrismaParticipantReader } from './persistence/prisma-participant-reader.js';

@Module({
  imports: [ConventionModule],
  controllers: [ParticipantController],
  providers: [
    { provide: CLOCK, useClass: ParisClock },
    { provide: PARTICIPANT_READER, useClass: PrismaParticipantReader },
    {
      provide: ReadParticipantList,
      useFactory: (conventions: ConventionRepository, reader: ParticipantReader, clock: Clock) =>
        new ReadParticipantList(conventions, reader, clock),
      inject: [CONVENTION_REPOSITORY, PARTICIPANT_READER, CLOCK],
    },
  ],
})
export class ParticipantModule {}
