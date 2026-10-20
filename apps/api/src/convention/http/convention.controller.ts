import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import type { ConventionReader } from '@chimeres/application';
import type { ConventionDto } from '@chimeres/contract';
import { CONVENTION_READER } from '../convention-reader.token.js';

@Controller('convention')
export class ConventionController {
  constructor(@Inject(CONVENTION_READER) private readonly reader: ConventionReader) {}

  @Get()
  async read(): Promise<ConventionDto> {
    const convention = await this.reader.read();
    if (!convention) throw new NotFoundException('Aucune convention enregistrée');
    return convention;
  }
}
