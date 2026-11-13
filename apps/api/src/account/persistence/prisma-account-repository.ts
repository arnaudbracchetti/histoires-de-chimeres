import { Inject, Injectable } from '@nestjs/common';
import type { AccountRepository } from '@chimeres/application';
import { Account, ComparableName } from '@chimeres/domain';
import { instantOfParisMoment, parisMomentOf } from '../../clock/paris-clock.js';
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

  async list(): Promise<Account[]> {
    return (await this.prisma.account.findMany()).map(restore);
  }

  async findByParticipantId(participantId: string): Promise<Account | null> {
    const row = await this.prisma.account.findUnique({ where: { participantId } });
    return row ? restore(row) : null;
  }

  async findByAccessLinkTokenHash(tokenHash: string): Promise<Account | null> {
    const row = await this.prisma.account.findUnique({ where: { accessLinkTokenHash: tokenHash } });
    return row ? restore(row) : null;
  }

  async saveAccessLinkUse(account: Account, usedTokenHash: string): Promise<boolean> {
    const { count } = await this.prisma.account.updateMany({
      where: { id: account.id, accessLinkTokenHash: usedTokenHash, accessLinkUsed: false },
      data: { passwordHash: account.passwordHash, accessLinkUsed: true },
    });
    return count === 1;
  }

  async save(account: Account): Promise<void> {
    const expiresAt = account.accessLinkExpiresAt;
    const data = {
      organizer: account.isOrganizer,
      passwordHash: account.passwordHash,
      accessLinkTokenHash: account.accessLinkTokenHash,
      accessLinkExpiresAt: expiresAt && instantOfParisMoment(expiresAt),
      accessLinkUsed: account.isAccessLinkUsed,
    };
    await this.prisma.account.upsert({
      where: { id: account.id },
      create: { id: account.id, participantId: account.participantId, ...data },
      update: data,
    });
  }

  /** Ses sessions partent avec lui (clé étrangère en cascade). */
  async remove(account: Account): Promise<void> {
    await this.prisma.account.deleteMany({ where: { id: account.id } });
  }
}

function restore(row: {
  id: string;
  participantId: string;
  organizer: boolean;
  passwordHash: string | null;
  accessLinkTokenHash: string | null;
  accessLinkExpiresAt: Date | null;
  accessLinkUsed: boolean;
}): Account {
  const { accessLinkTokenHash: tokenHash, accessLinkExpiresAt: expiresAt } = row;
  return Account.restore({
    id: row.id,
    participantId: row.participantId,
    organizer: row.organizer,
    passwordHash: row.passwordHash,
    accessLink:
      tokenHash && expiresAt
        ? { tokenHash, expiresAt: parisMomentOf(expiresAt), used: row.accessLinkUsed }
        : null,
  });
}
