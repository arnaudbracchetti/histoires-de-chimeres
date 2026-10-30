import { endpoint } from './endpoint.js';

/** L'abonnement push d'un téléphone, tel que le donne `PushSubscription.toJSON()`. */
export type PushSubscriptionBody = {
  /** L'adresse du service push : elle n'appartient qu'à un seul téléphone relié. */
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** La clé publique VAPID, avec laquelle le téléphone s'abonne. */
export type PushPublicKeyDto = {
  publicKey: string;
};

/**
 * L'abonnement push du téléphone relié. Le téléphone le renvoie à chaque ouverture et après chaque
 * liaison. Sans clés VAPID sur le serveur, `readPublicKey` refuse avec `push-not-configured` : le
 * front office affiche « Ce téléphone ne reçoit pas les notifications ».
 */
export const pushSubscriptionEndpoints = {
  /** Range l'abonnement sur ce téléphone, et l'enlève d'un autre : 204, ou `phone-not-linked`. */
  save: endpoint<void, never, PushSubscriptionBody>(
    'PUT',
    'front-office/linked-phone/push-subscription',
  ),
  readPublicKey: endpoint<PushPublicKeyDto>('GET', 'front-office/push-public-key'),
};
