import { Body, Controller, Delete, Inject, Param, Post, Put } from '@nestjs/common';
import { AddTable, RemoveTable, RenameTable, type ConventionReader } from '@chimeres/application';
import { tableEndpoints, type ResponseOf, type TableNameBody } from '@chimeres/contract';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { CONVENTION_READER } from '../../convention/convention-reader.token.js';
import { tableNameBodySchema } from './table-name-body.schema.js';

/** Chaque écriture renvoie la convention relue, avec ses tables dans l'ordre naturel. */
@Controller()
export class TableController {
  constructor(
    @Inject(CONVENTION_READER) private readonly reader: ConventionReader,
    @Inject(AddTable) private readonly addTable: AddTable,
    @Inject(RenameTable) private readonly renameTable: RenameTable,
    @Inject(RemoveTable) private readonly removeTable: RemoveTable,
  ) {}

  @Post(tableEndpoints.add.path)
  async add(
    @Body(new ZodBody(tableNameBodySchema)) body: TableNameBody,
  ): Promise<ResponseOf<typeof tableEndpoints.add>> {
    await this.addTable.execute(body);
    return this.reader.read();
  }

  @Put(tableEndpoints.rename.path)
  async rename(
    @Param('tableId') tableId: string,
    @Body(new ZodBody(tableNameBodySchema)) body: TableNameBody,
  ): Promise<ResponseOf<typeof tableEndpoints.rename>> {
    await this.renameTable.execute(tableId, body);
    return this.reader.read();
  }

  @Delete(tableEndpoints.remove.path)
  async remove(
    @Param('tableId') tableId: string,
  ): Promise<ResponseOf<typeof tableEndpoints.remove>> {
    await this.removeTable.execute(tableId);
    return this.reader.read();
  }
}
