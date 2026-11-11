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
  Query,
} from '@nestjs/common';
import {
  AddLatecomerToPublishedDraw,
  AppointRole,
  AddParticipant,
  MergeParticipant,
  ReadMergeVerdict,
  ReadParticipantList,
  ReadParticipantSheet,
  RemoveParticipant,
  RenameParticipant,
  UnlinkParticipantPhones,
  SignUpParticipantForGame,
  WithdrawParticipantFromDraw,
  WithdrawParticipantFromGame,
  WithdrawRole,
} from '@chimeres/application';
import {
  participantEndpoints,
  type ParticipantListQuery,
  type ParticipantNicknameBody,
  type ResponseOf,
} from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { ActingAccountId } from '../../account/http/acting-account-id.decorator.js';
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
    @Inject(RemoveParticipant) private readonly removeParticipant: RemoveParticipant,
    @Inject(MergeParticipant) private readonly mergeParticipant: MergeParticipant,
    @Inject(ReadMergeVerdict) private readonly readMergeVerdictQuery: ReadMergeVerdict,
    @Inject(SignUpParticipantForGame)
    private readonly signUpParticipantForGame: SignUpParticipantForGame,
    @Inject(WithdrawParticipantFromGame)
    private readonly withdrawParticipantFromGame: WithdrawParticipantFromGame,
    @Inject(WithdrawParticipantFromDraw)
    private readonly withdrawParticipantFromDraw: WithdrawParticipantFromDraw,
    @Inject(AddLatecomerToPublishedDraw)
    private readonly addLatecomerToPublishedDraw: AddLatecomerToPublishedDraw,
    @Inject(UnlinkParticipantPhones)
    private readonly unlinkParticipantPhones: UnlinkParticipantPhones,
    @Inject(AppointRole) private readonly appointRole: AppointRole,
    @Inject(WithdrawRole) private readonly withdrawRole: WithdrawRole,
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

  @Delete(participantEndpoints.remove.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('participantId') participantId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.remove>> {
    return this.removeParticipant.execute(participantId);
  }

  /** Fusionne le pseudo dans la destination (ID-11), et rend la fiche de la destination. */
  @Post(participantEndpoints.merge.path)
  @HttpCode(HttpStatus.OK)
  async merge(
    @Param('participantId') participantId: string,
    @Param('destinationId') destinationId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.merge>> {
    await this.mergeParticipant.execute(participantId, destinationId);
    return this.readSheetOrRefuse(destinationId);
  }

  @Get(participantEndpoints.readMergeVerdict.path)
  readMergeVerdict(
    @Param('participantId') participantId: string,
    @Param('destinationId') destinationId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.readMergeVerdict>> {
    return this.readMergeVerdictQuery.execute(participantId, destinationId);
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

  /** Ajoute le pseudo au tirage publié du créneau, non placé (ID-14), et rend la fiche relue. */
  @Put(participantEndpoints.addLatecomer.path)
  async addLatecomer(
    @Param('participantId') participantId: string,
    @Param('timeSlotId') timeSlotId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.addLatecomer>> {
    await this.addLatecomerToPublishedDraw.execute(participantId, timeSlotId);
    return this.readSheetOrRefuse(participantId);
  }

  /** Coupe tous les liens du pseudo (ID-8), et rend la fiche relue. */
  @Delete(participantEndpoints.unlinkPhones.path)
  async unlinkPhones(
    @Param('participantId') participantId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.unlinkPhones>> {
    await this.unlinkParticipantPhones.execute(participantId);
    return this.readSheetOrRefuse(participantId);
  }

  /** Donne le rôle Organisateur (ID-16), et rend la fiche relue. */
  @Put(participantEndpoints.appointOrganizer.path)
  async appointOrganizer(
    @Param('participantId') participantId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.appointOrganizer>> {
    await this.appointRole.execute(participantId, 'organizer');
    return this.readSheetOrRefuse(participantId);
  }

  /** Retire le rôle Organisateur (ID-16), sauf à soi-même, et rend la fiche relue. */
  @Delete(participantEndpoints.withdrawOrganizerRole.path)
  async withdrawOrganizerRole(
    @ActingAccountId() actingAccountId: string,
    @Param('participantId') participantId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.withdrawOrganizerRole>> {
    await this.withdrawRole.execute(actingAccountId, participantId, 'organizer');
    return this.readSheetOrRefuse(participantId);
  }

  /** Donne le rôle MJ (ID-4, ID-16), et rend la fiche relue. */
  @Put(participantEndpoints.appointGameMaster.path)
  async appointGameMaster(
    @Param('participantId') participantId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.appointGameMaster>> {
    await this.appointRole.execute(participantId, 'game-master');
    return this.readSheetOrRefuse(participantId);
  }

  /** Retire le rôle MJ (ID-16, PR-12), et rend la fiche relue. */
  @Delete(participantEndpoints.withdrawGameMasterRole.path)
  async withdrawGameMasterRole(
    @ActingAccountId() actingAccountId: string,
    @Param('participantId') participantId: string,
  ): Promise<ResponseOf<typeof participantEndpoints.withdrawGameMasterRole>> {
    await this.withdrawRole.execute(actingAccountId, participantId, 'game-master');
    return this.readSheetOrRefuse(participantId);
  }

  private async readSheetOrRefuse(participantId: string) {
    const sheet = await this.readParticipantSheet.execute(participantId);
    if (!sheet) throw new Refusal('participant-not-found', {});
    return sheet;
  }
}
