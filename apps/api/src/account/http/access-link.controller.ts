import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChooseAccessLinkPassword, CreateAccessLink, ReadAccessLink } from '@chimeres/application';
import {
  accessLinkEndpoints,
  type ChooseAccessLinkPasswordBody,
  type ResponseOf,
} from '@chimeres/contract';
import { buildAccessLinkUrl, readAccessLinkPublicUrl } from '../../http/access-link-url.js';
import { ZodPipe } from '../../http/zod.pipe.js';
import { setAccountSessionCookie } from './account-session-cookie.js';
import { chooseAccessLinkPasswordBodySchema } from './choose-access-link-password-body.schema.js';

/**
 * Le lien d'accès d'un compte (ID-6, ADR 0018). Le jeton passe dans le chemin : rien ici ne
 * journalise l'URL, et la page du back office qui le porte est servie sans `Referer`
 * (`configureApp`).
 */
@Controller()
export class AccessLinkController {
  constructor(
    @Inject(CreateAccessLink) private readonly createAccessLink: CreateAccessLink,
    @Inject(ReadAccessLink) private readonly readAccessLink: ReadAccessLink,
    @Inject(ChooseAccessLinkPassword)
    private readonly chooseAccessLinkPassword: ChooseAccessLinkPassword,
  ) {}

  /** L'URL se construit sur le domaine public (`PUBLIC_URL`), lu à chaque création. */
  @Post(accessLinkEndpoints.create.path)
  async create(
    @Param('participantId') participantId: string,
  ): Promise<ResponseOf<typeof accessLinkEndpoints.create>> {
    // Avant la création : sans adresse publique, le compte n'est pas remis à zéro pour rien.
    const publicUrl = readAccessLinkPublicUrl();
    const { token, expiresAt } = await this.createAccessLink.execute(participantId);
    return { url: buildAccessLinkUrl(publicUrl, token), expiresAt };
  }

  @Get(accessLinkEndpoints.read.path)
  read(@Param('token') token: string): Promise<ResponseOf<typeof accessLinkEndpoints.read>> {
    return this.readAccessLink.execute(token);
  }

  @Post(accessLinkEndpoints.choosePassword.path)
  @HttpCode(HttpStatus.OK)
  async choosePassword(
    @Param('token') token: string,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodPipe(chooseAccessLinkPasswordBodySchema)) body: ChooseAccessLinkPasswordBody,
  ): Promise<ResponseOf<typeof accessLinkEndpoints.choosePassword>> {
    const { sessionId, account } = await this.chooseAccessLinkPassword.execute(token, body);
    setAccountSessionCookie(response, sessionId);
    return account;
  }
}
