import { Module } from '@nestjs/common';
import { CONVENTION_READER } from './convention-reader.token.js';
import { ConventionController } from './http/convention.controller.js';
import { PrismaConventionReader } from './persistence/prisma-convention-reader.js';

@Module({
  controllers: [ConventionController],
  providers: [{ provide: CONVENTION_READER, useClass: PrismaConventionReader }],
})
export class ConventionModule {}
