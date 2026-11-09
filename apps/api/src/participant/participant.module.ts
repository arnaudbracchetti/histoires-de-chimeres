import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  AddParticipant,
  ReadParticipantList,
  ReadParticipantSheet,
  type Clock,
  type ConventionRepository,
  type ParticipantReader,
  type ScenarioRepository,
  type ScheduleReader,
} from '@chimeres/application';
import { CLOCK } from '../clock/clock.token.js';
import { ParisClock } from '../clock/paris-clock.js';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { SCHEDULE_READER } from '../game/schedule-reader.token.js';
import { GameModule } from '../game/game.module.js';
import { SCENARIO_REPOSITORY } from '../scenario/scenario-repository.token.js';
import { ScenarioModule } from '../scenario/scenario.module.js';
import { ParticipantController } from './http/participant.controller.js';
import { PARTICIPANT_READER } from './participant-reader.token.js';
import { PrismaParticipantReader } from './persistence/prisma-participant-reader.js';

@Module({
  imports: [ConventionModule, GameModule, ScenarioModule],
  controllers: [ParticipantController],
  providers: [
    { provide: CLOCK, useClass: ParisClock },
    { provide: PARTICIPANT_READER, useClass: PrismaParticipantReader },
    {
      provide: AddParticipant,
      useFactory: (repository: ConventionRepository) => new AddParticipant(repository, randomUUID),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: ReadParticipantList,
      useFactory: (conventions: ConventionRepository, reader: ParticipantReader, clock: Clock) =>
        new ReadParticipantList(conventions, reader, clock),
      inject: [CONVENTION_REPOSITORY, PARTICIPANT_READER, CLOCK],
    },
    {
      provide: ReadParticipantSheet,
      useFactory: (
        conventions: ConventionRepository,
        scenarios: ScenarioRepository,
        schedule: ScheduleReader,
        reader: ParticipantReader,
        clock: Clock,
      ) => new ReadParticipantSheet(conventions, scenarios, schedule, reader, clock),
      inject: [
        CONVENTION_REPOSITORY,
        SCENARIO_REPOSITORY,
        SCHEDULE_READER,
        PARTICIPANT_READER,
        CLOCK,
      ],
    },
  ],
})
export class ParticipantModule {}
