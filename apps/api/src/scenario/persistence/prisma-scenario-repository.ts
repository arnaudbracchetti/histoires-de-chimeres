import { Injectable } from '@nestjs/common';
import type { ScenarioRepository } from '@chimeres/application';
import {
  ContentWarnings,
  Scenario,
  ScenarioCatalogue,
  Seats,
  type Duration,
} from '@chimeres/domain';
import type { Scenario as ScenarioRow } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UUID } from '../../prisma/uuid.js';

@Injectable()
export class PrismaScenarioRepository implements ScenarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(scenarioId: string): Promise<Scenario | null> {
    if (!UUID.test(scenarioId)) return null;
    const row = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });
    return row && this.restore(row);
  }

  async findScenarioOfGameMaster(gameMasterId: string, scenarioId: string): Promise<Scenario | null> {
    if (!UUID.test(gameMasterId) || !UUID.test(scenarioId)) return null;
    const row = await this.prisma.scenario.findUnique({ where: { id: scenarioId, gameMasterId } });
    return row && this.restore(row);
  }

  private restore(row: ScenarioRow): Scenario {
    return Scenario.restore({
      id: row.id,
      gameMasterId: row.gameMasterId,
      title: row.title,
      system: row.system,
      presentation: row.presentation,
      contentWarnings: ContentWarnings.createFromText(row.contentWarnings),
      seats: Seats.createBetween(row.seatsMin, row.seatsMax),
      duration: row.duration as Duration,
      imageId: row.imageId,
    });
  }

  async catalogue(): Promise<ScenarioCatalogue> {
    const rows = await this.prisma.scenario.findMany({
      select: { id: true, gameMasterId: true, duration: true, seatsMin: true, seatsMax: true },
    });
    return ScenarioCatalogue.restore(
      rows.map(({ seatsMin, seatsMax, ...row }) => ({
        ...row,
        duration: row.duration as Duration,
        minSeats: seatsMin,
        maxSeats: seatsMax,
      })),
    );
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
