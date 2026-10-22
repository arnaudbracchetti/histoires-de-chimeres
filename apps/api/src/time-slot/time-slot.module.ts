import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  AddTimeSlot,
  ChangeTimeSlotHours,
  RemoveTimeSlot,
  type ConventionRepository,
} from '@chimeres/application';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { TimeSlotController } from './http/time-slot.controller.js';

@Module({
  imports: [ConventionModule],
  controllers: [TimeSlotController],
  providers: [
    {
      provide: AddTimeSlot,
      useFactory: (repository: ConventionRepository) => new AddTimeSlot(repository, randomUUID),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: ChangeTimeSlotHours,
      useFactory: (repository: ConventionRepository) => new ChangeTimeSlotHours(repository),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: RemoveTimeSlot,
      useFactory: (repository: ConventionRepository) => new RemoveTimeSlot(repository),
      inject: [CONVENTION_REPOSITORY],
    },
  ],
})
export class TimeSlotModule {}
