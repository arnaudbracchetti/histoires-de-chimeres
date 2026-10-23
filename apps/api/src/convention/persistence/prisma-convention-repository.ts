import { Injectable } from '@nestjs/common';
import { StaleConventionError, type ConventionRepository } from '@chimeres/application';
import {
  ComparableName,
  Convention,
  Game,
  GameMaster,
  Seats,
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
    const { id, name, date, version, timeSlots, tables, gameMasters, games } =
      await this.prisma.convention.findFirstOrThrow({
        include: {
          timeSlots: true,
          tables: true,
          gameMasters: { include: { availabilities: { select: { timeSlotId: true } } } },
          games: {
            include: { scenario: { select: { gameMasterId: true } }, timeSlots: true },
            orderBy: { scheduledAt: 'asc' },
          },
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
      games: games.map(
        (game) =>
          new Game(
            game.id,
            game.scenarioId,
            game.scenario.gameMasterId,
            game.timeSlots[0]!.tableId,
            game.timeSlots
              .map(({ timeSlotId }) => timeSlots.find((slot) => slot.id === timeSlotId)!)
              .sort((a, b) => a.startMinute - b.startMinute)
              .map((slot) => slot.id),
            game.seatsMin === null || game.seatsMax === null
              ? null
              : Seats.of(game.seatsMin, game.seatsMax),
          ),
      ),
      version,
    });
  }

  /**
   * N'écrit que si la version en base est encore celle du chargement (verrou optimiste), en une
   * transaction : la convention, ses créneaux, ses tables, ses MJ, leurs disponibilités et les
   * parties sont écrits ensemble, ou pas du tout. Les créneaux des parties partent en premier et
   * reviennent en dernier : ils tiennent les créneaux, les tables et les MJ (RESTRICT).
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

      await tx.gameTimeSlot.deleteMany({ where: { game: { conventionId: convention.id } } });
      await tx.game.deleteMany({
        where: {
          conventionId: convention.id,
          id: { notIn: convention.games.map(({ id }) => id) },
        },
      });

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

      for (const game of convention.games) {
        const seats = { seatsMin: game.seats?.min ?? null, seatsMax: game.seats?.max ?? null };
        await tx.game.upsert({
          where: { id: game.id },
          create: {
            id: game.id,
            conventionId: convention.id,
            scenarioId: game.scenarioId,
            ...seats,
          },
          update: seats,
        });
      }
      await tx.gameTimeSlot.createMany({
        data: convention.games.flatMap((game) =>
          game.timeSlotIds.map((timeSlotId) => ({
            gameId: game.id,
            timeSlotId,
            tableId: game.tableId,
            gameMasterId: game.gameMasterId,
          })),
        ),
      });
    });
  }
}
