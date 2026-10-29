import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Ip, Post } from '@nestjs/common';
import { ReadFrontOffice, VerifyPresenceCode } from '@chimeres/application';
import { frontOfficeEndpoints, type PresenceCodeBody, type ResponseOf } from '@chimeres/contract';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { PresenceCodeAttempts } from '../presence-code-attempts.js';
import { presenceCodeBodySchema } from './presence-code-body.schema.js';

/** Le front office : aucune requête `GET` n'y change rien, car Google rejoue l'adresse du QR code. */
@Controller()
export class FrontOfficeController {
  constructor(
    @Inject(ReadFrontOffice) private readonly readFrontOffice: ReadFrontOffice,
    @Inject(VerifyPresenceCode) private readonly verifyPresenceCode: VerifyPresenceCode,
    @Inject(PresenceCodeAttempts) private readonly attempts: PresenceCodeAttempts,
  ) {}

  @Get(frontOfficeEndpoints.read.path)
  read(): Promise<ResponseOf<typeof frontOfficeEndpoints.read>> {
    return this.readFrontOffice.execute();
  }

  @Post(frontOfficeEndpoints.verifyPresenceCode.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  verify(
    @Ip() ip: string,
    @Body(new ZodBody(presenceCodeBodySchema)) { presenceCode }: PresenceCodeBody,
  ): Promise<ResponseOf<typeof frontOfficeEndpoints.verifyPresenceCode>> {
    return this.attempts.guard(ip, () => this.verifyPresenceCode.execute(presenceCode));
  }
}
