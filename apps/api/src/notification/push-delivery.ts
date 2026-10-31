import { Logger } from '@nestjs/common';
import webpush from 'web-push';
import type { PushSubscriptionBody } from '@chimeres/contract';
import type { PushSettings } from './push-settings.js';

/** L'en-tête VAPID d'un service push se signe au plus une fois par heure (Apple). */
const VAPID_RENEWAL_MS = 3600_000;
/** Durée de validité du JWT VAPID, sous les 24 h du maximum. */
const VAPID_VALIDITY_S = 12 * 3600;
const REQUEST_TIMEOUT_MS = 10_000;
/** Sans échéance, tant que la convention n'a pas de date : le TTL par défaut des services push. */
const FOUR_WEEKS_S = 4 * 7 * 24 * 3600;

/** Ce que l'envoi a donné : livré au service push, abonnement mort (404 ou 410), ou échec. */
export type DeliveryOutcome = 'delivered' | 'gone' | 'failed';

/**
 * Envoie un message à un abonnement push : `web-push` le chiffre (`aes128gcm`) et signe l'en-tête
 * VAPID, `fetch` l'envoie. Une seule nouvelle tentative sur 429, 5xx ou erreur réseau, si le `TTL`
 * court encore. L'en-tête VAPID est gardé une heure par service push.
 */
export class PushDelivery {
  private readonly logger = new Logger(PushDelivery.name);
  private readonly vapidHeaders = new Map<string, { authorization: string; renewAt: number }>();

  constructor(
    private readonly settings: PushSettings,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * `expiresAt` : l'instant, en millisecondes, après lequel le message ne doit plus être livré, ou
   * `null` sans échéance (4 semaines). `topic` : un message en attente de même `Topic` est remplacé
   * par celui-ci chez le service push, ou `null`.
   */
  async deliver(
    subscription: PushSubscriptionBody,
    payload: string,
    expiresAt: number | null,
    topic: string | null,
  ): Promise<DeliveryOutcome> {
    const { cipherText } = webpush.encrypt(
      subscription.keys.p256dh,
      subscription.keys.auth,
      payload,
      'aes128gcm',
    );
    for (let attempt = 1; ; attempt++) {
      const ttl = expiresAt === null ? FOUR_WEEKS_S : Math.floor((expiresAt - this.now()) / 1000);
      if (ttl <= 0) return 'failed';
      const status = await this.post(subscription.endpoint, cipherText, ttl, topic);
      if (status !== null && status >= 200 && status < 300) return 'delivered';
      if (status === 404 || status === 410) return 'gone';
      const retriable = status === null || status === 429 || status >= 500;
      if (!retriable || attempt === 2) {
        this.logger.warn(
          `Envoi push refusé (${status ?? 'erreur réseau'}) : ${subscription.endpoint}`,
        );
        return 'failed';
      }
    }
  }

  /** Le statut de la réponse, ou `null` sur une erreur réseau ou un délai dépassé. */
  private async post(
    endpoint: string,
    body: Buffer,
    ttl: number,
    topic: string | null,
  ): Promise<number | null> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          TTL: String(ttl),
          Urgency: 'high',
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          Authorization: this.vapidAuthorizationFor(new URL(endpoint).origin),
          ...(topic && { Topic: topic }),
        },
        body: new Uint8Array(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return response.status;
    } catch {
      return null;
    }
  }

  private vapidAuthorizationFor(audience: string): string {
    const kept = this.vapidHeaders.get(audience);
    if (kept && this.now() < kept.renewAt) return kept.authorization;
    const { Authorization: authorization } = webpush.getVapidHeaders(
      audience,
      this.settings.subject,
      this.settings.publicKey,
      this.settings.privateKey,
      'aes128gcm',
      Math.floor(this.now() / 1000) + VAPID_VALIDITY_S,
    );
    this.vapidHeaders.set(audience, { authorization, renewAt: this.now() + VAPID_RENEWAL_MS });
    return authorization;
  }
}
