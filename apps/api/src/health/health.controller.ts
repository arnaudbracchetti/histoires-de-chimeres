import { Controller, Get } from '@nestjs/common';
import { healthEndpoints, type ResponseOf } from '@chimeres/contract';
import { PrismaService } from '../prisma/prisma.service.js';

/** Sondé par le HEALTHCHECK du Dockerfile et par Playwright avant de lancer ses tests. */
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(healthEndpoints.check.path)
  async check(): Promise<ResponseOf<typeof healthEndpoints.check>> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
