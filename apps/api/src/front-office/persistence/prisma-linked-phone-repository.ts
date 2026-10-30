import { Injectable } from '@nestjs/common';
import type { LinkedPhone, LinkedPhoneRepository } from '@chimeres/application';
import type { PushSubscriptionBody } from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PrismaLinkedPhoneRepository implements LinkedPhoneRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** L'heure de liaison est celle de la base, à l'écriture. */
  async link({ id, participantId }: LinkedPhone): Promise<void> {
    await this.prisma.linkedPhone.create({ data: { id, participantId } });
  }

  async find(phoneId: string): Promise<LinkedPhone | null> {
    return this.prisma.linkedPhone.findUnique({
      where: { id: phoneId },
      select: { id: true, participantId: true },
    });
  }

  async unlink(phoneId: string): Promise<void> {
    await this.prisma.linkedPhone.deleteMany({ where: { id: phoneId } });
  }

  async savePushSubscription(phoneId: string, { endpoint, keys }: PushSubscriptionBody): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.linkedPhone.updateMany({
        where: { pushEndpoint: endpoint, id: { not: phoneId } },
        data: { pushEndpoint: null, pushP256dh: null, pushAuth: null },
      }),
      this.prisma.linkedPhone.updateMany({
        where: { id: phoneId },
        data: { pushEndpoint: endpoint, pushP256dh: keys.p256dh, pushAuth: keys.auth },
      }),
    ]);
  }
}
