import { Injectable } from '@nestjs/common';
import { StaleConventionError, type ConventionRepository } from '@chimeres/application';
import { Convention, TimeOfDay, TimeSlot } from '@chimeres/domain';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fromDatabaseDate, toDatabaseDate } from './calendar-date.js';

@Injectable()
export class PrismaConventionRepository implements ConventionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Convention> {
    const { id, name, date, version, timeSlots } = await this.prisma.convention.findFirstOrThrow({
      include: { timeSlots: true },
    });
    return Convention.restore({
      id,
      name,
      date: fromDatabaseDate(date),
      timeSlots: timeSlots.map(
        (slot) =>
          new TimeSlot(
            slot.id,
            TimeOfDay.fromMinutes(slot.startMinute),
            TimeOfDay.fromMinutes(slot.endMinute),
          ),
      ),
      version,
    });
  }

  /**
   * N'écrit que si la version en base est encore celle du chargement (verrou optimiste), en une
   * transaction : la convention et ses créneaux sont écrits ensemble, ou pas du tout.
   */
  async save(convention: Convention): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.convention.updateMany({
        where: { id: convention.id, version: convention.version },
        data: {
          name: convention.name,
          date: toDatabaseDate(convention.date),
          version: { increment: 1 },
        },
      });
      if (count === 0) throw new StaleConventionError();

      const timeSlots = convention.timeSlots.map((slot) => ({
        id: slot.id,
        startMinute: slot.start.minutes,
        endMinute: slot.end.minutes,
      }));
      await tx.timeSlot.deleteMany({
        where: { conventionId: convention.id, id: { notIn: timeSlots.map(({ id }) => id) } },
      });
      for (const { id, ...hours } of timeSlots) {
        await tx.timeSlot.upsert({
          where: { id },
          create: { id, conventionId: convention.id, ...hours },
          update: hours,
        });
      }
    });
  }
}
