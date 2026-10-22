import { Module } from '@nestjs/common';
import { UpdateConvention, type ConventionRepository } from '@chimeres/application';
import { CONVENTION_READER } from './convention-reader.token.js';
import { CONVENTION_REPOSITORY } from './convention-repository.token.js';
import { ConventionController } from './http/convention.controller.js';
import { PrismaConventionReader } from './persistence/prisma-convention-reader.js';
import { PrismaConventionRepository } from './persistence/prisma-convention-repository.js';

@Module({
  controllers: [ConventionController],
  providers: [
    { provide: CONVENTION_READER, useClass: PrismaConventionReader },
    { provide: CONVENTION_REPOSITORY, useClass: PrismaConventionRepository },
    {
      provide: UpdateConvention,
      useFactory: (repository: ConventionRepository) => new UpdateConvention(repository),
      inject: [CONVENTION_REPOSITORY],
    },
  ],
  // Les créneaux sont des entités de l'agrégat : leur module lit et écrit la convention.
  exports: [CONVENTION_READER, CONVENTION_REPOSITORY],
})
export class ConventionModule {}
