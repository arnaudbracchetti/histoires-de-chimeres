import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { AddParticipant, ReadParticipantList, ReadParticipantSheet } from '@chimeres/application';
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

  private async readSheetOrRefuse(participantId: string) {
    const sheet = await this.readParticipantSheet.execute(participantId);
    if (!sheet) throw new Refusal('participant-not-found', {});
    return sheet;
  }
}
