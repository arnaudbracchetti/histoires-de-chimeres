import { Injectable } from '@nestjs/common';
import type { ConventionReader } from '@chimeres/application';
import type { ConventionDto } from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PrismaConventionReader implements ConventionReader {
  constructor(private readonly prisma: PrismaService) {}

  read(): Promise<ConventionDto | null> {
    return this.prisma.convention.findFirst({ select: { id: true, name: true } });
  }
}
