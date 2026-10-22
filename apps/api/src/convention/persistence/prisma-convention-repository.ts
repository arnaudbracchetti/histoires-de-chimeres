import { Injectable } from '@nestjs/common';
import { StaleConventionError, type ConventionRepository } from '@chimeres/application';
import { Convention } from '@chimeres/domain';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fromDatabaseDate, toDatabaseDate } from './calendar-date.js';

@Injectable()
export class PrismaConventionRepository implements ConventionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Convention> {
    const { id, name, date, version } = await this.prisma.convention.findFirstOrThrow();
    return Convention.restore({ id, name, date: fromDatabaseDate(date), version });
  }

  /** N'écrit que si la version en base est encore celle du chargement (verrou optimiste). */
  async save(convention: Convention): Promise<void> {
    const { count } = await this.prisma.convention.updateMany({
      where: { id: convention.id, version: convention.version },
      data: {
        name: convention.name,
        date: toDatabaseDate(convention.date),
        version: { increment: 1 },
      },
    });
    if (count === 0) throw new StaleConventionError();
  }
}
