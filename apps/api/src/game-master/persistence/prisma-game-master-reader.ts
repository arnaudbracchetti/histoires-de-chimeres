import { Injectable } from '@nestjs/common';
import type { GameMasterReader } from '@chimeres/application';
import type { GameMasterDto } from '@chimeres/contract';
import { ComparableName } from '@chimeres/domain';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Un identifiant que la colonne `UUID` accepte : PostgreSQL refuse tout autre texte. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaGameMasterReader implements GameMasterReader {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<GameMasterDto[]> {
    const gameMasters = await this.prisma.gameMaster.findMany({
      select: { id: true, nickname: true },
    });
    // L'ordre naturel est celui du domaine, que PostgreSQL ne sait pas reproduire.
    return gameMasters.sort((a, b) =>
      ComparableName.of(a.nickname).compareTo(ComparableName.of(b.nickname)),
    );
  }

  read(gameMasterId: string): Promise<GameMasterDto | null> {
    if (!UUID.test(gameMasterId)) return Promise.resolve(null);
    return this.prisma.gameMaster.findUnique({
      where: { id: gameMasterId },
      select: { id: true, nickname: true },
    });
  }
}
