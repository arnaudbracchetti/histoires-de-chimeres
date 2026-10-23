import { Injectable } from '@nestjs/common';
import { StaleConventionError, type ConventionRepository } from '@chimeres/application';
import {
  ComparableName,
  Convention,
  GameMaster,
  Table,
  TimeOfDay,
  TimeSlot,
} from '@chimeres/domain';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fromDatabaseDate, toDatabaseDate } from './calendar-date.js';

@Injectable()
export class PrismaConventionRepository implements ConventionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Convention> {
    const { id, name, date, version, timeSlots, tables, gameMasters } =
      await this.prisma.convention.findFirstOrThrow({
        include: {
          timeSlots: true,
          tables: true,
          gameMasters: { include: { availabilities: { select: { timeSlotId: true } } } },
        },
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
      tables: tables.map((table) => new Table(table.id, ComparableName.of(table.name))),
      gameMasters: gameMasters.map(
        (gameMaster) =>
          new GameMaster(
            gameMaster.id,
            ComparableName.of(gameMaster.nickname),
            gameMaster.availabilities.map(({ timeSlotId }) => timeSlotId),
          ),
      ),
      version,
    });
  }

  /**
   * N'écrit que si la version en base est encore celle du chargement (verrou optimiste), en une
   * transaction : la convention, ses créneaux, ses tables, ses MJ et leurs disponibilités sont écrits
   * ensemble, ou pas du tout.
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

      const tables = convention.tables.map((table) => ({ id: table.id, name: table.name.text }));
      await tx.table.deleteMany({
        where: { conventionId: convention.id, id: { notIn: tables.map(({ id }) => id) } },
      });
      for (const { id, name } of tables) {
        await tx.table.upsert({
          where: { id },
          create: { id, conventionId: convention.id, name },
          update: { name },
        });
      }

      const gameMasters = convention.gameMasters.map((gameMaster) => ({
        id: gameMaster.id,
        nickname: gameMaster.nickname.text,
      }));
      await tx.gameMaster.deleteMany({
        where: { conventionId: convention.id, id: { notIn: gameMasters.map(({ id }) => id) } },
      });
      for (const { id, nickname } of gameMasters) {
        await tx.gameMaster.upsert({
          where: { id },
          create: { id, conventionId: convention.id, nickname },
          update: { nickname },
        });
      }

      await tx.availability.deleteMany({ where: { gameMaster: { conventionId: convention.id } } });
      await tx.availability.createMany({
        data: convention.gameMasters.flatMap((gameMaster) =>
          [...gameMaster.availabilities].map((timeSlotId) => ({
            gameMasterId: gameMaster.id,
            timeSlotId,
          })),
        ),
      });
    });
  }
}
