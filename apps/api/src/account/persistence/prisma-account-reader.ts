import { Inject, Injectable } from '@nestjs/common';
import type { AccountReader } from '@chimeres/application';
import type { ConnectedAccountDto } from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PrismaAccountReader implements AccountReader {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async read(accountId: string): Promise<ConnectedAccountDto | null> {
    const row = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: {
        organizer: true,
        participantId: true,
        participant: { select: { nickname: true, gameMaster: { select: { id: true } } } },
      },
    });
    if (!row) return null;
    return {
      nickname: row.participant.nickname,
      participantId: row.participantId,
      organizer: row.organizer,
      gameMasterId: row.participant.gameMaster?.id ?? null,
    };
  }
}
