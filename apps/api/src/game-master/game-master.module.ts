import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  AddGameMaster,
  DeclareAvailability,
  RemoveGameMaster,
  RenameGameMaster,
  WithdrawAvailability,
  type ConventionRepository,
} from '@chimeres/application';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { GAME_MASTER_READER } from './game-master-reader.token.js';
import { AvailabilityController } from './http/availability.controller.js';
import { GameMasterController } from './http/game-master.controller.js';
import { PrismaGameMasterReader } from './persistence/prisma-game-master-reader.js';

@Module({
  imports: [ConventionModule],
  controllers: [GameMasterController, AvailabilityController],
  providers: [
    { provide: GAME_MASTER_READER, useClass: PrismaGameMasterReader },
    {
      provide: AddGameMaster,
      useFactory: (repository: ConventionRepository) => new AddGameMaster(repository, randomUUID),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: RenameGameMaster,
      useFactory: (repository: ConventionRepository) => new RenameGameMaster(repository),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: RemoveGameMaster,
      useFactory: (repository: ConventionRepository) => new RemoveGameMaster(repository),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: DeclareAvailability,
      useFactory: (repository: ConventionRepository) => new DeclareAvailability(repository),
      inject: [CONVENTION_REPOSITORY],
    },
    {
      provide: WithdrawAvailability,
      useFactory: (repository: ConventionRepository) => new WithdrawAvailability(repository),
      inject: [CONVENTION_REPOSITORY],
    },
  ],
})
export class GameMasterModule {}
