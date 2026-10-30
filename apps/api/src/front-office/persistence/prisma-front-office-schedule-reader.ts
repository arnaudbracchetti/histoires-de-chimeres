import { Injectable } from '@nestjs/common';
import type { FrontOfficeScheduleReader } from '@chimeres/application';
import {
  apiUrl,
  scenarioEndpoints,
  type FrontOfficeGameDto,
  type FrontOfficeScheduleDto,
} from '@chimeres/contract';
import { ComparableName, Convention, TimeOfDay } from '@chimeres/domain';
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
                  select: { gameMaster: { select: { games: { select: { timeSlotId: true } } } } },
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
            timeSlots: {
              select: {
                timeSlotId: true,
                timeSlot: { select: { startMinute: true } },
                table: { select: { name: true } },
              },
              orderBy: { timeSlot: { startMinute: 'asc' } },
            },
          },
        },
      },
    });
    const conventionDate = fromDatabaseDate(date);
    const end = Convention.endOf(
      conventionDate,
      timeSlots.map((slot) => TimeOfDay.fromMinutes(slot.endMinute)),
    );
    return {
      date: conventionDate,
      timeSlots: timeSlots.map((slot, index) => ({
        id: slot.id,
        rank: index + 1,
        start: TimeOfDay.fromMinutes(slot.startMinute).toString(),
        end: TimeOfDay.fromMinutes(slot.endMinute).toString(),
      })),
      games: games
        // L'ordre naturel des tables est celui du domaine, que PostgreSQL ne sait pas reproduire.
        .sort(
          (a, b) =>
            ComparableName.of(a.timeSlots[0]!.table.name).compareTo(
              ComparableName.of(b.timeSlots[0]!.table.name),
            ) || a.timeSlots[0]!.timeSlot.startMinute - b.timeSlots[0]!.timeSlot.startMinute,
        )
        .map(({ id, signUps, scenario, timeSlots: gameSlots }): FrontOfficeGameDto => {
          const timeSlotIds = gameSlots.map(({ timeSlotId }) => timeSlotId);
          const signUpCount = signUps.filter(
            ({ participant }) =>
              !Convention.isSignUpSuspended(
                timeSlotIds,
                participant.gameMaster?.games.map(({ timeSlotId }) => timeSlotId) ?? [],
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
            oversubscribed: signUpCount > scenario.seatsMax,
          };
        }),
      end: end && { date: end.date, time: end.time.toString() },
    };
  }
}
