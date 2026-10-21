import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import type { ConventionReader } from '@chimeres/application';
import { conventionEndpoints, type ResponseOf } from '@chimeres/contract';
import { CONVENTION_READER } from '../convention-reader.token.js';

@Controller()
export class ConventionController {
  constructor(@Inject(CONVENTION_READER) private readonly reader: ConventionReader) {}

  @Get(conventionEndpoints.read.path)
  async read(): Promise<ResponseOf<typeof conventionEndpoints.read>> {
    const convention = await this.reader.read();
    if (!convention) throw new NotFoundException('Aucune convention enregistrée');
    return convention;
  }
}
