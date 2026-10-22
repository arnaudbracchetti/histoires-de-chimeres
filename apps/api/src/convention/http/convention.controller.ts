import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { UpdateConvention, type ConventionReader } from '@chimeres/application';
import {
  conventionEndpoints,
  type ResponseOf,
  type UpdateConventionBody,
} from '@chimeres/contract';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { CONVENTION_READER } from '../convention-reader.token.js';
import { updateConventionBodySchema } from './update-convention-body.schema.js';

@Controller()
export class ConventionController {
  constructor(
    @Inject(CONVENTION_READER) private readonly reader: ConventionReader,
    @Inject(UpdateConvention) private readonly updateConvention: UpdateConvention,
  ) {}

  @Get(conventionEndpoints.read.path)
  read(): Promise<ResponseOf<typeof conventionEndpoints.read>> {
    return this.reader.read();
  }

  @Put(conventionEndpoints.update.path)
  async update(
    @Body(new ZodBody(updateConventionBodySchema)) body: UpdateConventionBody,
  ): Promise<ResponseOf<typeof conventionEndpoints.update>> {
    await this.updateConvention.execute(body);
    return this.reader.read();
  }
}
