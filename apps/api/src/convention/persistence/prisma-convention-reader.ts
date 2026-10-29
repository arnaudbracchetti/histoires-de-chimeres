import { Injectable } from '@nestjs/common';
import type { ConventionReader } from '@chimeres/application';
import type { ConventionDto } from '@chimeres/contract';
import { ComparableName, Convention, TimeOfDay, type LocalMoment } from '@chimeres/domain';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fromDatabaseDate } from './calendar-date.js';

@Injectable()
export class PrismaConventionReader implements ConventionReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(): Promise<ConventionDto> {
    const { id, name, date, presenceCode, timeSlots, tables } =
      await this.prisma.convention.findFirstOrThrow({
        select: {
          id: true,
          name: true,
          date: true,
          presenceCode: true,
          timeSlots: {
            orderBy: { startMinute: 'asc' },
            include: { _count: { select: { availabilities: true } } },
          },
          tables: { select: { id: true, name: true } },
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
        availabilityCount: slot._count.availabilities,
      })),
      // L'ordre naturel est celui du domaine, que PostgreSQL ne sait pas reproduire.
      tables: tables.sort((a, b) => ComparableName.of(a.name).compareTo(ComparableName.of(b.name))),
      end: endDtoOf(
        Convention.endOf(
          fromDatabaseDate(date),
          timeSlots.map((slot) => TimeOfDay.fromMinutes(slot.endMinute)),
        ),
      ),
      presenceCode,
    };
  }
}

function endDtoOf(end: LocalMoment | null): ConventionDto['end'] {
  return end && { date: end.date, time: end.time.toString() };
}
