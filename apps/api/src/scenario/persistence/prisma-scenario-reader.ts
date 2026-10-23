import { Injectable } from '@nestjs/common';
import type { ScenarioReader } from '@chimeres/application';
import type { ScenarioDto } from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UUID } from '../../prisma/uuid.js';
import { SCENARIO_SUMMARY_SELECT, toScenarioSummary } from './scenario-summary.js';

@Injectable()
export class PrismaScenarioReader implements ScenarioReader {
  constructor(private readonly prisma: PrismaService) {}

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
