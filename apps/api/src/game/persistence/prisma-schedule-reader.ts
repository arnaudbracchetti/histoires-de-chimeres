import { Injectable } from '@nestjs/common';
import type { ScheduleReader } from '@chimeres/application';
import type { GameDto, ScheduleScenarioDto } from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  byTitle,
  SCENARIO_SUMMARY_SELECT,
  toScenarioSummary,
} from '../../scenario/persistence/scenario-summary.js';

const SCHEDULE_SCENARIO_SELECT = {
  ...SCENARIO_SUMMARY_SELECT,
  gameMaster: { select: { id: true, nickname: true } },
};

@Injectable()
export class PrismaScheduleReader implements ScheduleReader {
  constructor(private readonly prisma: PrismaService) {}

  async games(): Promise<GameDto[]> {
    const rows = await this.prisma.game.findMany({
      include: {
        scenario: { select: SCHEDULE_SCENARIO_SELECT },
        timeSlots: { include: { timeSlot: { select: { startMinute: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return rows.map(
      ({ id, seatsMin, seatsMax, scenario: { gameMaster, ...summary }, timeSlots }) => {
        const slots = timeSlots.sort((a, b) => a.timeSlot.startMinute - b.timeSlot.startMinute);
        const scenario = { ...toScenarioSummary(summary), gameMaster };
        return {
          id,
          tableId: slots[0]!.tableId,
          timeSlotIds: slots.map(({ timeSlotId }) => timeSlotId),
          seats:
            seatsMin === null || seatsMax === null
              ? scenario.seats
              : { min: seatsMin, max: seatsMax },
          scenario,
        };
      },
    );
  }

  async scenarios(scenarioIds: readonly string[]): Promise<ScheduleScenarioDto[]> {
    const rows = await this.prisma.scenario.findMany({
      where: { id: { in: [...scenarioIds] } },
      select: SCHEDULE_SCENARIO_SELECT,
    });
    return rows
      .map(({ gameMaster, ...summary }) => ({ ...toScenarioSummary(summary), gameMaster }))
      .sort(byTitle);
  }
}
