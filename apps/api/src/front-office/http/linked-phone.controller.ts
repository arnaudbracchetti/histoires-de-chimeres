import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Identify, ReadLinkedPhone, UnlinkPhone } from '@chimeres/application';
import { linkedPhoneEndpoints, type LinkPhoneBody, type ResponseOf } from '@chimeres/contract';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { PresenceCodeAttempts } from '../presence-code-attempts.js';
import { linkPhoneBodySchema } from './link-phone-body.schema.js';
import {
  clearLinkedPhoneCookie,
  linkedPhoneIdOf,
  setLinkedPhoneCookie,
} from './linked-phone-cookie.js';

/** Le téléphone relié à un pseudo, par son cookie (ADR 0009). */
@Controller()
export class LinkedPhoneController {
  constructor(
    @Inject(ReadLinkedPhone) private readonly readLinkedPhone: ReadLinkedPhone,
    @Inject(Identify) private readonly identify: Identify,
    @Inject(UnlinkPhone) private readonly unlinkPhone: UnlinkPhone,
    @Inject(PresenceCodeAttempts) private readonly attempts: PresenceCodeAttempts,
  ) {}

  @Get(linkedPhoneEndpoints.read.path)
  read(@Req() request: Request): Promise<ResponseOf<typeof linkedPhoneEndpoints.read>> {
    return this.readLinkedPhone.execute(linkedPhoneIdOf(request));
  }

  /** Les codes de présence faux comptent dans la limite d'essais de l'adresse IP (ID-2). */
  @Post(linkedPhoneEndpoints.link.path)
  @HttpCode(HttpStatus.OK)
  async link(
    @Ip() ip: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodBody(linkPhoneBodySchema)) body: LinkPhoneBody,
  ): Promise<ResponseOf<typeof linkedPhoneEndpoints.link>> {
    const result = await this.attempts.guard(ip, () =>
      this.identify.execute(body, linkedPhoneIdOf(request)),
    );
    if (result.status === 'confirmation-needed') return result;
    setLinkedPhoneCookie(response, result.phoneId);
    return { status: result.status, nickname: result.nickname };
  }

  @Delete(linkedPhoneEndpoints.unlink.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlink(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ResponseOf<typeof linkedPhoneEndpoints.unlink>> {
    await this.unlinkPhone.execute(linkedPhoneIdOf(request));
    clearLinkedPhoneCookie(response);
  }
}
