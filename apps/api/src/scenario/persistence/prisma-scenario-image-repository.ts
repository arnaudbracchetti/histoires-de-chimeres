import { Injectable } from '@nestjs/common';
import type { ScenarioImageRepository } from '@chimeres/application';
import type { Scenario } from '@chimeres/domain';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PrismaScenarioImageRepository implements ScenarioImageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(scenario: Scenario, bytes: Uint8Array | null): Promise<void> {
    const { id: scenarioId, imageId } = scenario;
    await this.prisma.$transaction([
      ...(imageId && bytes
        ? [
            this.prisma.scenarioImage.create({
              data: { id: imageId, scenarioId, bytes: new Uint8Array(bytes) },
            }),
          ]
        : []),
      this.prisma.scenario.update({ where: { id: scenarioId }, data: { imageId } }),
      this.prisma.scenarioImage.deleteMany({
        where: { scenarioId, ...(imageId && { id: { not: imageId } }) },
      }),
    ]);
  }
}
