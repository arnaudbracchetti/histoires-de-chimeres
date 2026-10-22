import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  AddTable,
  RemoveTable,
  RenameTable,
  type ConventionRepository,
} from '@chimeres/application';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { TableController } from './http/table.controller.js';

@Module({
  imports: [ConventionModule],
  controllers: [TableController],
  providers: [
    {
      provide: AddTable,
      useFactory: (repository: ConventionRepository) => new AddTable(repository, randomUUID),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: RenameTable,
      useFactory: (repository: ConventionRepository) => new RenameTable(repository),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: RemoveTable,
      useFactory: (repository: ConventionRepository) => new RemoveTable(repository),
      inject: [CONVENTION_REPOSITORY],
    },
  ],
})
export class TableModule {}
