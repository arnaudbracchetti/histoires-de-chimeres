import { Injectable } from '@nestjs/common';
import type { ConventionReader } from '@chimeres/application';
import type { ConventionDto } from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PrismaConventionReader implements ConventionReader {
  constructor(private readonly prisma: PrismaService) {}

  read(): Promise<ConventionDto> {
    return this.prisma.convention.findFirstOrThrow({ select: { id: true, name: true } });
  }
}
