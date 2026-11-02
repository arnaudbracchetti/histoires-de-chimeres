import { Controller, Delete, HttpCode, HttpStatus, Inject, Param, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SignUpForGame, WithdrawFromDraw, WithdrawFromGame } from '@chimeres/application';
import { signUpEndpoints, type ResponseOf } from '@chimeres/contract';
import { linkedPhoneIdOf } from './linked-phone-cookie.js';

/**
 * L'inscription du pseudo du téléphone relié à une partie (IN-2), et sa participation au tirage d'un
 * créneau où il est sans partie, sans effet si on les répète.
 */
@Controller()
export class SignUpController {
  constructor(
    @Inject(SignUpForGame) private readonly signUpForGame: SignUpForGame,
    @Inject(WithdrawFromGame) private readonly withdrawFromGame: WithdrawFromGame,
    @Inject(WithdrawFromDraw) private readonly withdrawFromDraw: WithdrawFromDraw,
  ) {}

  @Put(signUpEndpoints.signUp.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  signUp(
    @Req() request: Request,
    @Param('gameId') gameId: string,
  ): Promise<ResponseOf<typeof signUpEndpoints.signUp>> {
    return this.signUpForGame.execute(linkedPhoneIdOf(request), gameId);
  }

  @Delete(signUpEndpoints.withdraw.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  withdraw(
    @Req() request: Request,
    @Param('gameId') gameId: string,
  ): Promise<ResponseOf<typeof signUpEndpoints.withdraw>> {
    return this.withdrawFromGame.execute(linkedPhoneIdOf(request), gameId);
  }

  @Delete(signUpEndpoints.withdrawFromDraw.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  withdrawFromDrawOnTimeSlot(
    @Req() request: Request,
    @Param('timeSlotId') timeSlotId: string,
  ): Promise<ResponseOf<typeof signUpEndpoints.withdrawFromDraw>> {
    return this.withdrawFromDraw.execute(linkedPhoneIdOf(request), timeSlotId);
  }
}
