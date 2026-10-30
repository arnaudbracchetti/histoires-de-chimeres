import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LinkedPhoneRepository, NotificationSender } from '@chimeres/application';
import type { PushSubscriptionBody } from '@chimeres/contract';
import type { Notification } from '@chimeres/domain';
import { instantOfParisMoment } from '../clock/paris-clock.js';
import { LINKED_PHONE_REPOSITORY } from '../front-office/linked-phone-repository.token.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { notificationCatalogue, type NotificationText } from './notification-catalogue.js';
import { PushDelivery } from './push-delivery.js';
import { PUSH_SETTINGS } from './push-settings.token.js';
import type { PushSettings } from './push-settings.js';

/** Envois menés en même temps. */
const CONCURRENT_DELIVERIES = 10;

/**
 * Écrit chaque notification en français et l'envoie, en arrière-plan et sans file, aux abonnements
 * des téléphones reliés à ses destinataires au moment de l'envoi (NO-1, ADR 0010). Une notification
 * échue ne part pas (NO-3). Un abonnement mort est effacé ; le lien du téléphone reste. Sans
 * réglages push, rien ne part.
 */
@Injectable()
export class WebPushNotificationSender implements NotificationSender {
  private readonly logger = new Logger(WebPushNotificationSender.name);
  private readonly delivery: PushDelivery | null;

  constructor(
    @Inject(PUSH_SETTINGS) private readonly settings: PushSettings | null,
    @Inject(LINKED_PHONE_REPOSITORY) private readonly phones: LinkedPhoneRepository,
    private readonly prisma: PrismaService,
  ) {
    this.delivery = settings && new PushDelivery(settings);
  }

  send(notifications: readonly Notification[]): void {
    if (!this.delivery || !notifications.length) return;
    this.deliverAll(this.delivery, notifications).catch((error: unknown) =>
      this.logger.error('Envoi des notifications interrompu', error),
    );
  }

  private async deliverAll(
    delivery: PushDelivery,
    notifications: readonly Notification[],
  ): Promise<void> {
    const titles = await this.scenarioTitlesOf(notifications);
    const deliveries: {
      subscription: PushSubscriptionBody;
      payload: string;
      expiresAt: number | null;
    }[] = [];
    for (const notification of notifications) {
      const expiresAt = notification.deadline
        ? instantOfParisMoment(notification.deadline).getTime()
        : null;
      const title = titles.get(notification.params.scenarioId);
      if ((expiresAt !== null && expiresAt <= Date.now()) || title === undefined) continue;
      const payload = JSON.stringify(this.messageOf(textOf(notification, title)));
      for (const subscription of await this.phones.pushSubscriptionsOf(notification.recipients)) {
        deliveries.push({ subscription, payload, expiresAt });
      }
    }
    await inParallel(deliveries, CONCURRENT_DELIVERIES, async (item) => {
      const outcome = await delivery.deliver(item.subscription, item.payload, item.expiresAt);
      if (outcome === 'gone') await this.phones.erasePushSubscription(item.subscription.endpoint);
    });
  }

  /**
   * Un seul JSON pour les deux formats : Declarative Web Push (`web_push`, `navigate`) pour Safari,
   * et `data.onActionClick` pour le service worker d'Angular ailleurs (ADR 0010).
   */
  private messageOf({ title, body, url }: NotificationText): object {
    const origin = this.settings!.publicUrl;
    return {
      web_push: 8030,
      notification: {
        title,
        body,
        navigate: `${origin}${url}`,
        lang: 'fr',
        icon: `${origin}/icons/icon-192.png`,
        badge: `${origin}/icons/badge-96.png`,
        data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url } } },
      },
    };
  }

  /** Les titres des scénarios des notifications, par identifiant. */
  private async scenarioTitlesOf(
    notifications: readonly Notification[],
  ): Promise<Map<string, string>> {
    const scenarios = await this.prisma.scenario.findMany({
      where: { id: { in: [...new Set(notifications.map(({ params }) => params.scenarioId))] } },
      select: { id: true, title: true },
    });
    return new Map(scenarios.map(({ id, title }) => [id, title]));
  }
}

/** Le texte de la notification, par le catalogue de son code. */
function textOf(notification: Notification, scenarioTitle: string): NotificationText {
  const write = notificationCatalogue[notification.code] as (
    params: Notification['params'],
    title: string,
  ) => NotificationText;
  return write(notification.params, scenarioTitle);
}

/** Mène `work` sur chaque élément, `limit` à la fois au plus. */
async function inParallel<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
