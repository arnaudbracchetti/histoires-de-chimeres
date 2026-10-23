import { Injectable } from '@nestjs/common';
import type { ScenarioRepository } from '@chimeres/application';
import {
  ContentWarnings,
  Scenario,
  ScenarioCatalogue,
  Seats,
  type Duration,
} from '@chimeres/domain';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UUID } from '../../prisma/uuid.js';

@Injectable()
export class PrismaScenarioRepository implements ScenarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(scenarioId: string): Promise<Scenario | null> {
    if (!UUID.test(scenarioId)) return null;
    const row = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!row) return null;
    return Scenario.restore({
      id: row.id,
      gameMasterId: row.gameMasterId,
      title: row.title,
      system: row.system,
      presentation: row.presentation,
      contentWarnings: ContentWarnings.of(row.contentWarnings),
      seats: Seats.of(row.seatsMin, row.seatsMax),
      duration: row.duration as Duration,
      imageId: row.imageId,
    });
  }

  async catalogue(): Promise<ScenarioCatalogue> {
    const rows = await this.prisma.scenario.findMany({ select: { id: true, gameMasterId: true } });
    return ScenarioCatalogue.restore(rows);
  }

  /** L'image s'écrit à part, avec ses octets (`ScenarioImageRepository`). */
  async save(scenario: Scenario): Promise<void> {
    const data = {
      title: scenario.title,
      system: scenario.system,
      presentation: scenario.presentation,
      contentWarnings: scenario.contentWarnings.text,
      seatsMin: scenario.seats.min,
      seatsMax: scenario.seats.max,
      duration: scenario.duration,
    };
    await this.prisma.scenario.upsert({
      where: { id: scenario.id },
      create: { id: scenario.id, gameMasterId: scenario.gameMasterId, ...data },
      update: data,
    });
  }

  async remove(scenario: Scenario): Promise<void> {
    await this.prisma.scenario.delete({ where: { id: scenario.id } });
  }
}
