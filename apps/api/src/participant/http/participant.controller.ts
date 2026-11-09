import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import {
  AddParticipant,
  ReadParticipantList,
  ReadParticipantSheet,
  RenameParticipant,
  SignUpParticipantForGame,
  WithdrawParticipantFromDraw,
  WithdrawParticipantFromGame,
} from '@chimeres/application';
import {
  participantEndpoints,
  type ParticipantListQuery,
  type ParticipantNicknameBody,
  type ResponseOf,
} from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { ZodPipe } from '../../http/zod.pipe.js';
import { participantListQuerySchema } from './participant-list-query.schema.js';
import { participantNicknameBodySchema } from './participant-nickname-body.schema.js';

@Controller()
export class ParticipantController {
  constructor(
    @Inject(ReadParticipantList) private readonly readParticipantList: ReadParticipantList,
    @Inject(ReadParticipantSheet) private readonly readParticipantSheet: ReadParticipantSheet,
    @Inject(AddParticipant) private readonly addParticipant: AddParticipant,
    @Inject(RenameParticipant) private readonly renameParticipant: RenameParticipant,
    @Inject(SignUpParticipantForGame)
    private readonly signUpParticipantForGame: SignUpParticipantForGame,
    @Inject(WithdrawParticipantFromGame)
    private readonly withdrawParticipantFromGame: WithdrawParticipantFromGame,
    @Inject(WithdrawParticipantFromDraw)
    private readonly withdrawParticipantFromDraw: WithdrawParticipantFromDraw,
  ) {}

  @Get(participantEndpoints.list.path)
  list(
    @Query(new ZodPipe(participantListQuerySchema)) { search }: ParticipantListQuery,
  ): Promise<ResponseOf<typeof participantEndpoints.list>> {
    return this.readParticipantList.execute(search);
  }

  @Get(participantEndpoints.read.path)
  read(
    @Param('participantId') participantId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.read>> {
    return this.readSheetOrRefuse(participantId);
  }

  /** Rend la fiche du pseudo créé, que le back office ouvre aussitôt. */
  @Post(participantEndpoints.add.path)
  async add(
    @Body(new ZodPipe(participantNicknameBodySchema)) body: ParticipantNicknameBody,
  ): Promise<ResponseOf<typeof participantEndpoints.add>> {
    return this.readSheetOrRefuse(await this.addParticipant.execute(body));
  }

  /** Rend la fiche relue. */
  @Put(participantEndpoints.rename.path)
  async rename(
    @Param('participantId') participantId: string,
    @Body(new ZodPipe(participantNicknameBodySchema)) body: ParticipantNicknameBody,
  ): Promise<ResponseOf<typeof participantEndpoints.rename>> {
    await this.renameParticipant.execute(participantId, body);
    return this.readSheetOrRefuse(participantId);
  }

  /** Inscrit le pseudo à la partie, à sa place (ID-12), et rend la fiche relue. */
  @Put(participantEndpoints.signUp.path)
  async signUp(
    @Param('participantId') participantId: string,
    @Param('gameId') gameId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.signUp>> {
    await this.signUpParticipantForGame.execute(participantId, gameId);
    return this.readSheetOrRefuse(participantId);
  }

  /** Désinscrit le pseudo de la partie, à sa place (ID-12), et rend la fiche relue. */
  @Delete(participantEndpoints.withdraw.path)
  async withdraw(
    @Param('participantId') participantId: string,
    @Param('gameId') gameId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.withdraw>> {
    await this.withdrawParticipantFromGame.execute(participantId, gameId);
    return this.readSheetOrRefuse(participantId);
  }

  /** Retire du tirage du créneau le pseudo sans partie, à sa place (IN-6), et rend la fiche relue. */
  @Delete(participantEndpoints.withdrawFromDraw.path)
  async withdrawFromDraw(
    @Param('participantId') participantId: string,
    @Param('timeSlotId') timeSlotId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.withdrawFromDraw>> {
    await this.withdrawParticipantFromDraw.execute(participantId, timeSlotId);
    return this.readSheetOrRefuse(participantId);
  }

  private async readSheetOrRefuse(participantId: string) {
    const sheet = await this.readParticipantSheet.execute(participantId);
    if (!sheet) throw new Refusal('participant-not-found', {});
    return sheet;
  }
}
