import { Injectable } from '@nestjs/common';
import type { ConventionReader } from '@chimeres/application';
import type { ConventionDto } from '@chimeres/contract';
import { TimeOfDay } from '@chimeres/domain';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fromDatabaseDate } from './calendar-date.js';

@Injectable()
export class PrismaConventionReader implements ConventionReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(): Promise<ConventionDto> {
    const { id, name, date, timeSlots } = await this.prisma.convention.findFirstOrThrow({
      select: {
        id: true,
        name: true,
        date: true,
        timeSlots: { orderBy: { startMinute: 'asc' } },
      },
    });
    return {
      id,
      name,
      date: fromDatabaseDate(date),
      timeSlots: timeSlots.map((slot, index) => ({
        id: slot.id,
        rank: index + 1,
        start: TimeOfDay.fromMinutes(slot.startMinute).toString(),
        end: TimeOfDay.fromMinutes(slot.endMinute).toString(),
      })),
    };
  }
}
