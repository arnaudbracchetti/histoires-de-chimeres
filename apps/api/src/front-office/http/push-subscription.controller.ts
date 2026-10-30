import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SavePushSubscription } from '@chimeres/application';
import {
  pushSubscriptionEndpoints,
  type PushSubscriptionBody,
  type ResponseOf,
} from '@chimeres/contract';
import { PushNotConfiguredError } from '../../http/push-not-configured.error.js';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { PUSH_SETTINGS } from '../../notification/push-settings.token.js';
import type { PushSettings } from '../../notification/push-settings.js';
import { linkedPhoneIdOf } from './linked-phone-cookie.js';
import { pushSubscriptionBodySchema } from './push-subscription-body.schema.js';

/** L'abonnement push du téléphone relié, et la clé publique VAPID avec laquelle il s'abonne. */
@Controller()
export class PushSubscriptionController {
  constructor(
    @Inject(SavePushSubscription) private readonly savePushSubscription: SavePushSubscription,
    @Inject(PUSH_SETTINGS) private readonly pushSettings: PushSettings | null,
  ) {}

  @Put(pushSubscriptionEndpoints.save.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  save(
    @Req() request: Request,
    @Body(new ZodBody(pushSubscriptionBodySchema)) body: PushSubscriptionBody,
  ): Promise<ResponseOf<typeof pushSubscriptionEndpoints.save>> {
    return this.savePushSubscription.execute(linkedPhoneIdOf(request), body);
  }

  @Get(pushSubscriptionEndpoints.readPublicKey.path)
  readPublicKey(): ResponseOf<typeof pushSubscriptionEndpoints.readPublicKey> {
    if (!this.pushSettings) throw new PushNotConfiguredError();
    return { publicKey: this.pushSettings.publicKey };
  }
}
