import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ReadParticipantList, ReadParticipantSheet } from '@chimeres/application';
import {
  participantEndpoints,
  type ParticipantListQuery,
  type ResponseOf,
} from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { ZodPipe } from '../../http/zod.pipe.js';
import { participantListQuerySchema } from './participant-list-query.schema.js';

@Controller()
export class ParticipantController {
  constructor(
    @Inject(ReadParticipantList) private readonly readParticipantList: ReadParticipantList,
    @Inject(ReadParticipantSheet) private readonly readParticipantSheet: ReadParticipantSheet,
  ) {}

  @Get(participantEndpoints.list.path)
  list(
    @Query(new ZodPipe(participantListQuerySchema)) { search }: ParticipantListQuery,
  ): Promise<ResponseOf<typeof participantEndpoints.list>> {
    return this.readParticipantList.execute(search);
  }

  @Get(participantEndpoints.read.path)
  async read(
    @Param('participantId') participantId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.read>> {
    const sheet = await this.readParticipantSheet.execute(participantId);
    if (!sheet) throw new Refusal('participant-not-found', {});
    return sheet;
  }
}
