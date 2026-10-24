import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  AddGameMaster,
  ReadGameMaster,
  RemoveGameMaster,
  RenameGameMaster,
  type GameMasterReader,
} from '@chimeres/application';
import {
  gameMasterEndpoints,
  type GameMasterNicknameBody,
  type ResponseOf,
} from '@chimeres/contract';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { GAME_MASTER_READER } from '../game-master-reader.token.js';
import { readSheetOrRefuse } from './game-master-sheet.js';
import { gameMasterNicknameBodySchema } from './game-master-nickname-body.schema.js';

@Controller()
export class GameMasterController {
  constructor(
    @Inject(GAME_MASTER_READER) private readonly reader: GameMasterReader,
    @Inject(ReadGameMaster) private readonly readGameMaster: ReadGameMaster,
    @Inject(AddGameMaster) private readonly addGameMaster: AddGameMaster,
    @Inject(RenameGameMaster) private readonly renameGameMaster: RenameGameMaster,
    @Inject(RemoveGameMaster) private readonly removeGameMaster: RemoveGameMaster,
  ) {}

  @Get(gameMasterEndpoints.list.path)
  list(): Promise<ResponseOf<typeof gameMasterEndpoints.list>> {
    return this.reader.list();
  }

  @Get(gameMasterEndpoints.read.path)
  read(
    @Param('gameMasterId') gameMasterId: string,
  ): Promise<ResponseOf<typeof gameMasterEndpoints.read>> {
    return readSheetOrRefuse(this.readGameMaster, gameMasterId);
  }

  /** Renvoie la liste relue, pour la saisie à la chaîne. */
  @Post(gameMasterEndpoints.add.path)
  async add(
    @Body(new ZodBody(gameMasterNicknameBodySchema)) body: GameMasterNicknameBody,
  ): Promise<ResponseOf<typeof gameMasterEndpoints.add>> {
    await this.addGameMaster.execute(body);
    return this.reader.list();
  }

  /** Renvoie la fiche relue. */
  @Put(gameMasterEndpoints.rename.path)
  async rename(
    @Param('gameMasterId') gameMasterId: string,
    @Body(new ZodBody(gameMasterNicknameBodySchema)) body: GameMasterNicknameBody,
  ): Promise<ResponseOf<typeof gameMasterEndpoints.rename>> {
    await this.renameGameMaster.execute(gameMasterId, body);
    return readSheetOrRefuse(this.readGameMaster, gameMasterId);
  }

  @Delete(gameMasterEndpoints.remove.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('gameMasterId') gameMasterId: string,
  ): Promise<ResponseOf<typeof gameMasterEndpoints.remove>> {
    return this.removeGameMaster.execute(gameMasterId);
  }
}
