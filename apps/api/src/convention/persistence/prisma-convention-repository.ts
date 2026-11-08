import { Injectable } from '@nestjs/common';
import { StaleConventionError, type ConventionRepository } from '@chimeres/application';
import {
  Assignment,
  ComparableName,
  Convention,
  Draw,
  Game,
  GameMaster,
  Participant,
  ParticipantWithoutGame,
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
        timeSlots: {
          include: { draw: { include: { assignments: true, cancelledGames: true } } },
        },
        tables: true,
        gameMasters: { include: { availabilities: { select: { timeSlotId: true } } } },
        participants: { include: { signUps: true, withoutGameOnTimeSlots: true } },
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
      participantsWithoutGame: participants
        .flatMap(({ withoutGameOnTimeSlots }) => withoutGameOnTimeSlots)
        .map(
          ({ participantId, timeSlotId }) => new ParticipantWithoutGame(participantId, timeSlotId),
        ),
      draws: timeSlots.flatMap(({ draw }) =>
        draw
          ? [
              new Draw(
                draw.timeSlotId,
                draw.published,
                draw.assignments.map(
                  ({ participantId, gameId, movedByHand }) =>
                    new Assignment(participantId, gameId, movedByHand),
                ),
                draw.cancelledGames.map(({ gameId }) => gameId),
              ),
            ]
          : [],
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
    const participantsWithoutGame = changes(
      loaded.participantsWithoutGame,
      current.participantsWithoutGame,
    );
    const draws = changes(loaded.draws, current.draws);
    const drawAssignments = changes(loaded.drawAssignments, current.drawAssignments);
    const cancelledGames = changes(loaded.cancelledGames, current.cancelledGames);
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

      await deleteRowsIfAny(signUps.removed, (rows) =>
        tx.signUp.deleteMany({
          where: { OR: rows.map(({ participantId, gameId }) => ({ participantId, gameId })) },
        }),
      );
      await deleteRowsIfAny(participantsWithoutGame.removed, (rows) =>
        tx.participantWithoutGame.deleteMany({
          where: {
            OR: rows.map(({ participantId, timeSlotId }) => ({ participantId, timeSlotId })),
          },
        }),
      );
      // Une affectation retient sa partie (RESTRICT), et un tirage son créneau : ils partent avant.
      await deleteRowsIfAny(drawAssignments.removed, (rows) =>
        tx.drawAssignment.deleteMany({
          where: {
            OR: rows.map(({ timeSlotId, participantId }) => ({ timeSlotId, participantId })),
          },
        }),
      );
      await deleteRowsIfAny(cancelledGames.removed, (rows) =>
        tx.cancelledGame.deleteMany({
          where: { gameId: { in: rows.map(({ gameId }) => gameId) } },
        }),
      );
      await deleteRowsIfAny(draws.removed, (rows) =>
        tx.draw.deleteMany({
          where: { timeSlotId: { in: rows.map(({ timeSlotId }) => timeSlotId) } },
        }),
      );
      await deleteRowsIfAny(moved, (rows) =>
        tx.gameTimeSlot.deleteMany({ where: { gameId: ids(rows) } }),
      );
      await deleteRowsIfAny(unscheduled, (rows) =>
        tx.game.deleteMany({ where: { id: ids(rows) } }),
      );
      await deleteRowsIfAny(availabilities.removed, (rows) =>
        tx.availability.deleteMany({
          where: {
            OR: rows.map(({ gameMasterId, timeSlotId }) => ({ gameMasterId, timeSlotId })),
          },
        }),
      );
      await deleteRowsIfAny(timeSlots.removed, (rows) =>
        tx.timeSlot.deleteMany({ where: { id: ids(rows) } }),
      );
      await deleteRowsIfAny(tables.removed, (rows) =>
        tx.table.deleteMany({ where: { id: ids(rows) } }),
      );
      await deleteRowsIfAny(gameMasters.removed, (rows) =>
        tx.gameMaster.deleteMany({ where: { id: ids(rows) } }),
      );
      await deleteRowsIfAny(participants.removed, (rows) =>
        tx.participant.deleteMany({ where: { id: ids(rows) } }),
      );

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
      await tx.participantWithoutGame.createMany({ data: participantsWithoutGame.added });
      await tx.draw.createMany({ data: draws.added });
      for (const { timeSlotId, published } of draws.changed) {
        await tx.draw.update({ where: { timeSlotId }, data: { published } });
      }
      await tx.drawAssignment.createMany({ data: drawAssignments.added });
      for (const { timeSlotId, participantId, ...assignment } of drawAssignments.changed) {
        await tx.drawAssignment.update({
          where: { timeSlotId_participantId: { timeSlotId, participantId } },
          data: assignment,
        });
      }
      await tx.cancelledGame.createMany({ data: cancelledGames.added });
    });
  }
}

/**
 * Prisma envoie un `DELETE … WHERE 1=0` même pour une liste vide : un aller-retour vers la base
 * pour rien, à chaque sauvegarde. Sans ligne à supprimer, aucune requête ne part.
 */
async function deleteRowsIfAny<Row>(
  rows: Row[],
  deleteRows: (rows: Row[]) => Promise<unknown>,
): Promise<void> {
  if (rows.length > 0) await deleteRows(rows);
}
