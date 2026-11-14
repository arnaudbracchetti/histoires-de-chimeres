import { Controller, Get } from '@nestjs/common';
import { healthEndpoints, type ResponseOf } from '@chimeres/contract';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Sondé par le HEALTHCHECK du Dockerfile et par Playwright avant de lancer ses tests. Donne aussi
 * la version qui répond : `APP_VERSION`, posée dans l'image par le build-arg du même nom.
 */
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(healthEndpoints.check.path)
  async check(): Promise<ResponseOf<typeof healthEndpoints.check>> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', version: process.env['APP_VERSION'] || 'dev' };
  }
}
