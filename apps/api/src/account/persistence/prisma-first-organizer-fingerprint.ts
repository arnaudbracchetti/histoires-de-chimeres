import { Inject, Injectable } from '@nestjs/common';
import type { FirstOrganizerFingerprint } from '@chimeres/application';
import { PrismaService } from '../../prisma/prisma.service.js';

/** L'empreinte vit sur la convention, unique dans la base. */
@Injectable()
export class PrismaFirstOrganizerFingerprint implements FirstOrganizerFingerprint {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async read(): Promise<string | null> {
    const convention = await this.prisma.convention.findFirstOrThrow({
      select: { firstOrganizerFingerprint: true },
    });
    return convention.firstOrganizerFingerprint;
  }

  async save(fingerprint: string): Promise<void> {
    await this.prisma.convention.updateMany({ data: { firstOrganizerFingerprint: fingerprint } });
  }
}
