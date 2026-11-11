import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AccountSessions, Clock } from '@chimeres/application';
import { CLOCK } from '../../clock/clock.token.js';
import { instantOfParisMoment } from '../../clock/paris-clock.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sans activité pendant 7 jours, la session se ferme (ADR 0019). */
const INACTIVITY_MS = 7 * DAY_MS;
/** Dans tous les cas, 30 jours après la connexion (ADR 0019). */
export const SESSION_MAX_MS = 30 * DAY_MS;

/** L'empreinte gardée en base : le SHA-256 de l'identifiant, en hexadécimal. */
export function hashSessionId(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

/**
 * Les sessions du back office en base (ADR 0019) : identifiant de 256 bits tiré au hasard, en
 * base64url ; seule son empreinte est gardée. L'heure vient de l'horloge de la convention.
 */
@Injectable()
export class PrismaAccountSessions implements AccountSessions {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async open(accountId: string): Promise<string> {
    const sessionId = randomBytes(32).toString('base64url');
    const now = this.now();
    await this.prisma.accountSession.create({
      data: { idHash: hashSessionId(sessionId), accountId, openedAt: now, lastActiveAt: now },
    });
    return sessionId;
  }

  async findAccountIdAndExtend(sessionId: string): Promise<string | null> {
    const idHash = hashSessionId(sessionId);
    const session = await this.prisma.accountSession.findUnique({ where: { idHash } });
    if (!session) return null;
    const now = this.now();
    const expired =
      now.getTime() - session.lastActiveAt.getTime() >= INACTIVITY_MS ||
      now.getTime() - session.openedAt.getTime() >= SESSION_MAX_MS;
    if (expired) {
      await this.prisma.accountSession.deleteMany({ where: { idHash } });
      return null;
    }
    await this.prisma.accountSession.updateMany({
      where: { idHash },
      data: { lastActiveAt: now },
    });
    return session.accountId;
  }

  async close(sessionId: string): Promise<void> {
    await this.prisma.accountSession.deleteMany({ where: { idHash: hashSessionId(sessionId) } });
  }

  async closeAllOfAccount(accountId: string): Promise<void> {
    await this.prisma.accountSession.deleteMany({ where: { accountId } });
  }

  private now(): Date {
    return instantOfParisMoment(this.clock.now());
  }
}
