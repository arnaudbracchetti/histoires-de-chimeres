import { Injectable } from '@nestjs/common';
import type { LinkedPhoneReader } from '@chimeres/application';
import type { LinkedPhoneDto } from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PrismaLinkedPhoneReader implements LinkedPhoneReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(phoneId: string): Promise<LinkedPhoneDto | null> {
    const phone = await this.prisma.linkedPhone.findUnique({
      where: { id: phoneId },
      select: { participant: { select: { nickname: true, gameMaster: { select: { id: true } } } } },
    });
    return (
      phone && { nickname: phone.participant.nickname, gameMaster: !!phone.participant.gameMaster }
    );
  }
}
