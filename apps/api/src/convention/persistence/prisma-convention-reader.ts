import { Injectable } from '@nestjs/common';
import type { ConventionReader } from '@chimeres/application';
import type { ConventionDto } from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fromDatabaseDate } from './calendar-date.js';

@Injectable()
export class PrismaConventionReader implements ConventionReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(): Promise<ConventionDto> {
    const { id, name, date } = await this.prisma.convention.findFirstOrThrow({
      select: { id: true, name: true, date: true },
    });
    return { id, name, date: fromDatabaseDate(date) };
  }
}
