import { Inject, Injectable } from '@nestjs/common';
import type { AccountRepository } from '@chimeres/application';
import { Account, ComparableName } from '@chimeres/domain';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PrismaAccountRepository implements AccountRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Compare en mémoire, comme le domaine (ID-7) : la base ne sait pas retirer les accents. Les
   * comptes sont peu nombreux (Organisateurs et MJ).
   */
  async findByNickname(nickname: string): Promise<Account | null> {
    const wanted = ComparableName.createFromText(nickname);
    const rows = await this.prisma.account.findMany({
      include: { participant: { select: { nickname: true } } },
    });
    const row = rows.find(({ participant }) =>
      ComparableName.createFromText(participant.nickname).equals(wanted),
    );
    return row ? restore(row) : null;
  }

  async findById(accountId: string): Promise<Account | null> {
    const row = await this.prisma.account.findUnique({ where: { id: accountId } });
    return row ? restore(row) : null;
  }

  async findByParticipantId(participantId: string): Promise<Account | null> {
    const row = await this.prisma.account.findUnique({ where: { participantId } });
    return row ? restore(row) : null;
  }

  async save(account: Account): Promise<void> {
    const data = { organizer: account.isOrganizer, passwordHash: account.passwordHash };
    await this.prisma.account.upsert({
      where: { id: account.id },
      create: { id: account.id, participantId: account.participantId, ...data },
      update: data,
    });
  }
}

function restore(row: {
  id: string;
  participantId: string;
  organizer: boolean;
  passwordHash: string | null;
}): Account {
  return Account.restore({
    id: row.id,
    participantId: row.participantId,
    organizer: row.organizer,
    passwordHash: row.passwordHash,
  });
}
