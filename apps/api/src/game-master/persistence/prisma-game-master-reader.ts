import { Injectable } from '@nestjs/common';
import type { GameMasterReader } from '@chimeres/application';
import type { GameMasterDto } from '@chimeres/contract';
import { ComparableName } from '@chimeres/domain';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UUID } from '../../prisma/uuid.js';
import {
  byTitle,
  SCENARIO_SUMMARY_SELECT,
  toScenarioSummary,
} from '../../scenario/persistence/scenario-summary.js';

/** Le pseudo, les disponibilités dans l'ordre de la journée, et les scénarios. */
const SELECT = {
  id: true,
  nickname: true,
  availabilities: {
    select: { timeSlotId: true },
    orderBy: { timeSlot: { startMinute: 'asc' } },
  },
  scenarios: { select: SCENARIO_SUMMARY_SELECT },
} satisfies Prisma.GameMasterSelect;

type GameMasterRow = Prisma.GameMasterGetPayload<{ select: typeof SELECT }>;

@Injectable()
export class PrismaGameMasterReader implements GameMasterReader {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<GameMasterDto[]> {
    const gameMasters = await this.prisma.gameMaster.findMany({ select: SELECT });
    // L'ordre naturel est celui du domaine, que PostgreSQL ne sait pas reproduire.
    return gameMasters
      .map(toDto)
      .sort((a, b) => ComparableName.of(a.nickname).compareTo(ComparableName.of(b.nickname)));
  }

  async read(gameMasterId: string): Promise<GameMasterDto | null> {
    if (!UUID.test(gameMasterId)) return null;
    const gameMaster = await this.prisma.gameMaster.findUnique({
      where: { id: gameMasterId },
      select: SELECT,
    });
    return gameMaster && toDto(gameMaster);
  }
}

function toDto({ id, nickname, availabilities, scenarios }: GameMasterRow): GameMasterDto {
  return {
    id,
    nickname,
    availabilities: availabilities.map(({ timeSlotId }) => timeSlotId),
    scenarios: scenarios.map(toScenarioSummary).sort(byTitle),
  };
}
