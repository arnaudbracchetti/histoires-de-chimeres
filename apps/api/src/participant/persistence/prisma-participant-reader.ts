import { Injectable } from '@nestjs/common';
import type { ParticipantReader, ParticipantRecord } from '@chimeres/application';
import { ComparableName } from '@chimeres/domain';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Le pseudo, le rôle de MJ, le nombre de téléphones, et les inscriptions dans leur ordre, chacune
 * avec le premier créneau de sa partie et le titre de son scénario.
 */
const SELECT = {
  id: true,
  nickname: true,
  gameMaster: { select: { id: true } },
  _count: { select: { linkedPhones: true } },
  signUps: {
    select: {
      game: {
        select: {
          scenario: { select: { title: true } },
          timeSlots: {
            select: { timeSlotId: true },
            orderBy: { timeSlot: { startMinute: 'asc' } },
            take: 1,
          },
        },
      },
    },
    orderBy: { signedUpAt: 'asc' },
  },
} satisfies Prisma.ParticipantSelect;

type ParticipantRow = Prisma.ParticipantGetPayload<{ select: typeof SELECT }>;

@Injectable()
export class PrismaParticipantReader implements ParticipantReader {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ParticipantRecord[]> {
    const participants = await this.prisma.participant.findMany({ select: SELECT });
    // L'ordre naturel est celui du domaine, que PostgreSQL ne sait pas reproduire.
    return participants
      .map(toRecord)
      .sort((a, b) =>
        ComparableName.createFromText(a.nickname).compareTo(
          ComparableName.createFromText(b.nickname),
        ),
      );
  }
}

function toRecord({ id, nickname, gameMaster, _count, signUps }: ParticipantRow): ParticipantRecord {
  return {
    id,
    nickname,
    gameMaster: gameMaster !== null,
    linkedPhoneCount: _count.linkedPhones,
    signUps: signUps.map(({ game }) => ({
      timeSlotId: game.timeSlots[0]!.timeSlotId,
      title: game.scenario.title,
    })),
  };
}
