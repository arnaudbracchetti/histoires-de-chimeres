import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ReadParticipantList } from '@chimeres/application';
import {
  participantEndpoints,
  type ParticipantListQuery,
  type ResponseOf,
} from '@chimeres/contract';
import { ZodPipe } from '../../http/zod.pipe.js';
import { participantListQuerySchema } from './participant-list-query.schema.js';

@Controller()
export class ParticipantController {
  constructor(
    @Inject(ReadParticipantList) private readonly readParticipantList: ReadParticipantList,
  ) {}

  @Get(participantEndpoints.list.path)
  list(
    @Query(new ZodPipe(participantListQuerySchema)) { search }: ParticipantListQuery,
  ): Promise<ResponseOf<typeof participantEndpoints.list>> {
    return this.readParticipantList.execute(search);
  }
}
