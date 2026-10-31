import { Injectable } from '@nestjs/common';
import { StaleConventionError, type ConventionRepository } from '@chimeres/application';
import {
  ComparableName,
  Convention,
  Game,
  GameMaster,
  Participant,
  PresenceCode,
  SignUp,
  Table,
  TimeOfDay,
  TimeSlot,
} from '@chimeres/domain';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fromDatabaseDate, toDatabaseDate } from './calendar-date.js';
import { changes, rowsOf, type ConventionRows } from './convention-rows.js';

@Injectable()
export class PrismaConventionRepository implements ConventionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Les lignes de chaque convention chargée, telles que la base les tenait : `save` n'écrit que ce
   * qui en diffère.
   */
  private readonly loaded = new WeakMap<Convention, ConventionRows>();

  async get(): Promise<Convention> {
    const {
      id,
      name,
      date,
      version,
      presenceCode,
      timeSlots,
      tables,
      gameMasters,
      participants,
      games,
    } = await this.prisma.convention.findFirstOrThrow({
      include: {
        timeSlots: true,
        tables: true,
        gameMasters: { include: { availabilities: { select: { timeSlotId: true } } } },
        participants: { include: { signUps: true } },
        games: {
          include: { scenario: { select: { gameMasterId: true } }, timeSlots: true },
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });
    const participantById = new Map(
      participants.map((participant) => [
        participant.id,
        new Participant(participant.id, ComparableName.createFromText(participant.nickname)),
      ]),
    );
    const convention = Convention.restore({
      id,
      name,
      date: fromDatabaseDate(date),
      timeSlots: timeSlots.map(
        (slot) =>
          new TimeSlot(
            slot.id,
            TimeOfDay.createFromMinutes(slot.startMinute),
            TimeOfDay.createFromMinutes(slot.endMinute),
          ),
      ),
      tables: tables.map((table) => new Table(table.id, ComparableName.createFromText(table.name))),
      gameMasters: gameMasters.map(
        (gameMaster) =>
          new GameMaster(
            gameMaster.id,
            participantById.get(gameMaster.participantId)!,
            gameMaster.availabilities.map(({ timeSlotId }) => timeSlotId),
          ),
      ),
      participants: [...participantById.values()],
      signUps: participants
        .flatMap(({ signUps }) => signUps)
        .sort((a, b) => a.signedUpAt.getTime() - b.signedUpAt.getTime())
        .map(({ participantId, gameId }) => new SignUp(participantId, gameId)),
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
          ),
      ),
      version,
      presenceCode: PresenceCode.parse(presenceCode),
    });
    this.loaded.set(convention, rowsOf(convention));
    return convention;
  }

  /**
   * N'écrit que si la version en base est encore celle du chargement (verrou optimiste), en une
   * transaction : tout ou rien. La base est alors dans l'état du chargement, donc seules les lignes
   * qui en diffèrent sont écrites. Les créneaux des parties déplacées partent en premier et
   * reviennent en dernier : ils tiennent les créneaux, les tables et les MJ (RESTRICT), et une partie
   * échangée prend la place d'une autre (index uniques).
   */
  async save(convention: Convention): Promise<void> {
    const loaded = this.loaded.get(convention);
    if (!loaded) throw new Error("La convention à sauvegarder n'a pas été chargée par get().");
    const current = rowsOf(convention);
    const timeSlots = changes(loaded.timeSlots, current.timeSlots);
    const tables = changes(loaded.tables, current.tables);
    const gameMasters = changes(loaded.gameMasters, current.gameMasters);
    const availabilities = changes(loaded.availabilities, current.availabilities);
    const participants = changes(loaded.participants, current.participants);
    const signUps = changes(loaded.signUps, current.signUps);
    const {
      removed: unscheduled,
      added: scheduled,
      changed: moved,
    } = changes(loaded.games, current.games);
    const ids = (rows: { id: string }[]) => ({ in: rows.map(({ id }) => id) });

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

      await tx.signUp.deleteMany({
        where: {
          OR: signUps.removed.map(({ participantId, gameId }) => ({ participantId, gameId })),
        },
      });
      await tx.gameTimeSlot.deleteMany({ where: { gameId: ids(moved) } });
      await tx.game.deleteMany({ where: { id: ids(unscheduled) } });
      await tx.availability.deleteMany({
        where: {
          OR: availabilities.removed.map(({ gameMasterId, timeSlotId }) => ({
            gameMasterId,
            timeSlotId,
          })),
        },
      });
      await tx.timeSlot.deleteMany({ where: { id: ids(timeSlots.removed) } });
      await tx.table.deleteMany({ where: { id: ids(tables.removed) } });
      await tx.gameMaster.deleteMany({ where: { id: ids(gameMasters.removed) } });
      await tx.participant.deleteMany({ where: { id: ids(participants.removed) } });

      const conventionId = convention.id;
      await tx.timeSlot.createMany({
        data: timeSlots.added.map((row) => ({ ...row, conventionId })),
      });
      for (const { id, ...hours } of timeSlots.changed) {
        await tx.timeSlot.update({ where: { id }, data: hours });
      }
      await tx.table.createMany({ data: tables.added.map((row) => ({ ...row, conventionId })) });
      for (const { id, name } of tables.changed) {
        await tx.table.update({ where: { id }, data: { name } });
      }
      // Un MJ tient son participant (RESTRICT) : le participant arrive d'abord.
      await tx.participant.createMany({
        data: participants.added.map((row) => ({ ...row, conventionId })),
      });
      // Seul le renommage d'un MJ change le pseudo d'un participant (ID-9, PR-12).
      for (const { id, nickname } of participants.changed) {
        await tx.participant.update({ where: { id }, data: { nickname } });
      }
      await tx.gameMaster.createMany({
        data: gameMasters.added.map((row) => ({ ...row, conventionId })),
      });
      await tx.availability.createMany({ data: availabilities.added });
      await tx.game.createMany({
        data: scheduled.map(({ id, scenarioId }) => ({ id, scenarioId, conventionId })),
      });
      await tx.gameTimeSlot.createMany({
        data: [...scheduled, ...moved].flatMap(({ timeSlots }) => timeSlots),
      });
      await tx.signUp.createMany({ data: signUps.added });
    });
  }
}
