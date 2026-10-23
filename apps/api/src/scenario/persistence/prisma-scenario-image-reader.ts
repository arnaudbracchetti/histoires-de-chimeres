import { Injectable } from '@nestjs/common';
import type { ScenarioImageReader } from '@chimeres/application';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UUID } from '../../prisma/uuid.js';

@Injectable()
export class PrismaScenarioImageReader implements ScenarioImageReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(scenarioId: string, imageId: string): Promise<Uint8Array | null> {
    if (!UUID.test(scenarioId) || !UUID.test(imageId)) return null;
    const row = await this.prisma.scenarioImage.findUnique({
      where: { id: imageId, scenarioId },
      select: { bytes: true },
    });
    return row?.bytes ?? null;
  }
}
