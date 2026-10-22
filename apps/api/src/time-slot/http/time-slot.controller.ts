import { Body, Controller, Delete, Inject, Param, Post, Put } from '@nestjs/common';
import {
  AddTimeSlot,
  ChangeTimeSlotHours,
  RemoveTimeSlot,
  type ConventionReader,
} from '@chimeres/application';
import { timeSlotEndpoints, type ResponseOf, type TimeSlotHoursBody } from '@chimeres/contract';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { CONVENTION_READER } from '../../convention/convention-reader.token.js';
import { timeSlotHoursBodySchema } from './time-slot-hours-body.schema.js';

/** Chaque écriture renvoie la convention relue, avec les rangs recalculés. */
@Controller()
export class TimeSlotController {
  constructor(
    @Inject(CONVENTION_READER) private readonly reader: ConventionReader,
    @Inject(AddTimeSlot) private readonly addTimeSlot: AddTimeSlot,
    @Inject(ChangeTimeSlotHours) private readonly changeTimeSlotHours: ChangeTimeSlotHours,
    @Inject(RemoveTimeSlot) private readonly removeTimeSlot: RemoveTimeSlot,
  ) {}

  @Post(timeSlotEndpoints.add.path)
  async add(
    @Body(new ZodBody(timeSlotHoursBodySchema)) body: TimeSlotHoursBody,
  ): Promise<ResponseOf<typeof timeSlotEndpoints.add>> {
    await this.addTimeSlot.execute(body);
    return this.reader.read();
  }

  @Put(timeSlotEndpoints.changeHours.path)
  async changeHours(
    @Param('timeSlotId') timeSlotId: string,
    @Body(new ZodBody(timeSlotHoursBodySchema)) body: TimeSlotHoursBody,
  ): Promise<ResponseOf<typeof timeSlotEndpoints.changeHours>> {
    await this.changeTimeSlotHours.execute(timeSlotId, body);
    return this.reader.read();
  }

  @Delete(timeSlotEndpoints.remove.path)
  async remove(
    @Param('timeSlotId') timeSlotId: string,
  ): Promise<ResponseOf<typeof timeSlotEndpoints.remove>> {
    await this.removeTimeSlot.execute(timeSlotId);
    return this.reader.read();
  }
}
