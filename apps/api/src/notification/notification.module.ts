import { Module } from '@nestjs/common';
import { LINKED_PHONE_REPOSITORY } from '../front-office/linked-phone-repository.token.js';
import { PrismaLinkedPhoneRepository } from '../front-office/persistence/prisma-linked-phone-repository.js';
import { NOTIFICATION_SENDER } from './notification-sender.token.js';
import { PUSH_SETTINGS } from './push-settings.token.js';
import { pushSettingsFromEnvironment } from './push-settings.js';
import { WebPushNotificationSender } from './web-push-notification-sender.js';

/**
 * L'envoi des notifications des gestes (ADR 0010), et ses réglages, que le front office lit aussi
 * pour servir la clé publique VAPID.
 */
@Module({
  providers: [
    { provide: PUSH_SETTINGS, useFactory: pushSettingsFromEnvironment },
    { provide: LINKED_PHONE_REPOSITORY, useClass: PrismaLinkedPhoneRepository },
    { provide: NOTIFICATION_SENDER, useClass: WebPushNotificationSender },
  ],
  exports: [PUSH_SETTINGS, NOTIFICATION_SENDER],
})
export class NotificationModule {}
