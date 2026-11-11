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
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ChangeOwnPassword, LogIn, LogOut, ReadOwnAccount } from '@chimeres/application';
import {
  accountEndpoints,
  type ChangeOwnPasswordBody,
  type LogInBody,
  type ResponseOf,
} from '@chimeres/contract';
import { ZodPipe } from '../../http/zod.pipe.js';
import type { LoginAttempts } from '../login-attempts.js';
import { LOGIN_ATTEMPTS } from '../login-attempts.token.js';
import {
  readAccountSessionId,
  clearAccountSessionCookie,
  setAccountSessionCookie,
} from './account-session-cookie.js';
import { changeOwnPasswordBodySchema } from './change-own-password-body.schema.js';
import { logInBodySchema } from './log-in-body.schema.js';

/** Le compte du back office et sa session, par son cookie (ADR 0015, 0019). */
@Controller()
export class AccountController {
  constructor(
    @Inject(ReadOwnAccount) private readonly readOwnAccount: ReadOwnAccount,
    @Inject(LogIn) private readonly logInCommand: LogIn,
    @Inject(LogOut) private readonly logOutCommand: LogOut,
    @Inject(ChangeOwnPassword) private readonly changeOwnPassword: ChangeOwnPassword,
    @Inject(LOGIN_ATTEMPTS) private readonly attempts: LoginAttempts,
  ) {}

  @Get(accountEndpoints.read.path)
  read(@Req() request: Request): Promise<ResponseOf<typeof accountEndpoints.read>> {
    return this.readOwnAccount.execute(readAccountSessionId(request));
  }

  /** Chaque essai compte dans la limite, réussi ou non (ADR 0018). */
  @Post(accountEndpoints.logIn.path)
  @HttpCode(HttpStatus.OK)
  async logIn(
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodPipe(logInBodySchema)) body: LogInBody,
  ): Promise<ResponseOf<typeof accountEndpoints.logIn>> {
    this.attempts.count(ip, body.nickname);
    const { sessionId, account } = await this.logInCommand.execute(body);
    setAccountSessionCookie(response, sessionId);
    return account;
  }

  @Delete(accountEndpoints.logOut.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ResponseOf<typeof accountEndpoints.logOut>> {
    await this.logOutCommand.execute(readAccountSessionId(request));
    clearAccountSessionCookie(response);
  }

  /**
   * Chaque essai compte dans la limite de la connexion, pour le pseudo du compte : une session
   * volée ne sert pas à chercher le mot de passe (ADR 0018).
   */
  @Put(accountEndpoints.changePassword.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Ip() ip: string,
    @Req() request: Request,
    @Body(new ZodPipe(changeOwnPasswordBodySchema)) body: ChangeOwnPasswordBody,
  ): Promise<ResponseOf<typeof accountEndpoints.changePassword>> {
    const sessionId = readAccountSessionId(request);
    const { nickname } = await this.readOwnAccount.execute(sessionId);
    this.attempts.count(ip, nickname);
    await this.changeOwnPassword.execute(sessionId, body);
  }
}
