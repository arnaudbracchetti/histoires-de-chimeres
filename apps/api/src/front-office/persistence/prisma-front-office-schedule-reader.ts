import { Injectable } from '@nestjs/common';
import type { FrontOfficeScheduleReader } from '@chimeres/application';
import {
  apiUrl,
  scenarioEndpoints,
  type FrontOfficeGameDto,
  type FrontOfficeScheduleDto,
} from '@chimeres/contract';
import { ComparableName, Convention, SignUps, TimeOfDay } from '@chimeres/domain';
import { fromDatabaseDate } from '../../convention/persistence/calendar-date.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PrismaFrontOfficeScheduleReader implements FrontOfficeScheduleReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(): Promise<FrontOfficeScheduleDto> {
    const { date, timeSlots, games } = await this.prisma.convention.findFirstOrThrow({
      select: {
        date: true,
        timeSlots: { orderBy: { startMinute: 'asc' } },
        games: {
          select: {
            id: true,
            signUps: {
              select: {
                participant: {
                  select: {
                    // Ses parties doubles, où un tirage publié l'a placé (TI-3).
                    drawAssignments: {
                      where: { draw: { published: true }, gameId: { not: null } },
                      select: {
                        game: {
                          select: {
                            timeSlots: {
                              select: { timeSlotId: true },
                              orderBy: { timeSlot: { startMinute: 'asc' } },
                            },
                          },
                        },
                      },
                    },
                    gameMaster: {
                      select: {
                        // Le MJ ne mène pas une partie annulée par un tirage (TI-6).
                        games: {
                          where: { game: { cancellation: null } },
                          select: { timeSlotId: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            scenario: {
              select: {
                id: true,
                title: true,
                system: true,
                presentation: true,
                contentWarnings: true,
                seatsMin: true,
                seatsMax: true,
                imageId: true,
                gameMaster: { select: { participant: { select: { nickname: true } } } },
              },
            },
            // Ses joueurs, dans un tirage publié de son premier créneau.
            assignments: { where: { draw: { published: true } }, select: { timeSlotId: true } },
            cancellation: { select: { gameId: true } },
            timeSlots: {
              select: {
                timeSlotId: true,
                timeSlot: { select: { startMinute: true, draw: { select: { published: true } } } },
                table: { select: { name: true } },
              },
              orderBy: { timeSlot: { startMinute: 'asc' } },
            },
          },
        },
      },
    });
    const conventionDate = fromDatabaseDate(date);
    const end = Convention.computeEnd(
      conventionDate,
      timeSlots.map((slot) => TimeOfDay.createFromMinutes(slot.endMinute)),
    );
    return {
      date: conventionDate,
      timeSlots: timeSlots.map((slot, index) => ({
        id: slot.id,
        rank: index + 1,
        start: TimeOfDay.createFromMinutes(slot.startMinute).toString(),
        end: TimeOfDay.createFromMinutes(slot.endMinute).toString(),
      })),
      games: games
        // L'ordre naturel des tables est celui du domaine, que PostgreSQL ne sait pas reproduire.
        .sort(
          (a, b) =>
            ComparableName.createFromText(a.timeSlots[0]!.table.name).compareTo(
              ComparableName.createFromText(b.timeSlots[0]!.table.name),
            ) || a.timeSlots[0]!.timeSlot.startMinute - b.timeSlots[0]!.timeSlot.startMinute,
        )
        .map(
          ({
            id,
            signUps,
            assignments,
            cancellation,
            scenario,
            timeSlots: gameSlots,
          }): FrontOfficeGameDto => {
            const timeSlotIds = gameSlots.map(({ timeSlotId }) => timeSlotId);
            const signUpCount = signUps.filter(({ participant }) =>
              SignUps.isSignUpActive(
                timeSlotIds,
                participant.gameMaster?.games.map(({ timeSlotId }) => timeSlotId) ?? [],
                participant.drawAssignments.flatMap(({ game }) =>
                  (game?.timeSlots ?? []).slice(1).map(({ timeSlotId }) => timeSlotId),
                ),
              ),
            ).length;
            return {
              id,
              timeSlotIds,
              tableName: gameSlots[0]!.table.name,
              title: scenario.title,
              system: scenario.system,
              gameMasterNickname: scenario.gameMaster.participant.nickname,
              imageUrl:
                scenario.imageId &&
                apiUrl(scenarioEndpoints.readImage, {
                  scenarioId: scenario.id,
                  imageId: scenario.imageId,
                }),
              presentation: scenario.presentation,
              contentWarnings: scenario.contentWarnings,
              seats: { min: scenario.seatsMin, max: scenario.seatsMax },
              signUpCount,
              // Une partie annulée n'a pas de place (TI-6).
              playerCount:
                gameSlots[0]!.timeSlot.draw?.published && !cancellation ? assignments.length : null,
              oversubscribed: signUpCount > scenario.seatsMax,
            };
          },
        ),
      end: end && { date: end.date, time: end.time.toString() },
    };
  }
}
