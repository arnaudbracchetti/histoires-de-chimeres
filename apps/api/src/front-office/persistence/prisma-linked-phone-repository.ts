import { Injectable } from '@nestjs/common';
import type { LinkedPhone, LinkedPhoneRepository } from '@chimeres/application';
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
}
