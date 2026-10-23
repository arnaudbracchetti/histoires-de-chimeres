import { Injectable } from '@nestjs/common';
import type { ScenarioReader } from '@chimeres/application';
import type { ScenarioDto, ScenarioListItemDto } from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UUID } from '../../prisma/uuid.js';
import { byTitle, SCENARIO_SUMMARY_SELECT, toScenarioSummary } from './scenario-summary.js';

@Injectable()
export class PrismaScenarioReader implements ScenarioReader {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ScenarioListItemDto[]> {
    const rows = await this.prisma.scenario.findMany({
      select: { ...SCENARIO_SUMMARY_SELECT, gameMaster: { select: { id: true, nickname: true } } },
    });
    return rows
      .map(({ gameMaster, ...summary }) => ({
        ...toScenarioSummary(summary),
        gameMaster,
        // Les parties arrivent avec la programmation.
        games: 0,
      }))
      .sort(byTitle);
  }

  async read(scenarioId: string): Promise<ScenarioDto | null> {
    if (!UUID.test(scenarioId)) return null;
    const row = await this.prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: {
        ...SCENARIO_SUMMARY_SELECT,
        presentation: true,
        contentWarnings: true,
        gameMaster: { select: { id: true, nickname: true } },
      },
    });
    if (!row) return null;
    const { presentation, contentWarnings, gameMaster, ...summary } = row;
    return { ...toScenarioSummary(summary), gameMaster, presentation, contentWarnings };
  }
}
