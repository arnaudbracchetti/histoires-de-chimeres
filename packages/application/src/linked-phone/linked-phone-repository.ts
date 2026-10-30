import type { PushSubscriptionBody } from '@chimeres/contract';

/**
 * Le téléphone relié à un pseudo (ADR 0009), hors de l'agrégat `Convention`. `id` est opaque :
 * c'est la valeur du cookie du téléphone. L'heure de liaison est celle de `link()`.
 */
export type LinkedPhone = {
  id: string;
  participantId: string;
};

/** Port d'écriture des téléphones reliés, implémenté par l'infrastructure. */
export interface LinkedPhoneRepository {
  /** Relie un téléphone, sans toucher aux autres téléphones du même pseudo (ID-8). */
  link(phone: LinkedPhone): Promise<void>;
  /** Le téléphone relié, ou `null` s'il n'est relié à aucun pseudo. */
  find(phoneId: string): Promise<LinkedPhone | null>;
  /** Coupe le lien du téléphone ; sans effet s'il n'en a pas. */
  unlink(phoneId: string): Promise<void>;
  /**
   * Range l'abonnement push du téléphone, à la place du précédent. Un endpoint n'appartient qu'à
   * un seul téléphone relié : le ranger ici l'enlève d'un autre.
   */
  savePushSubscription(phoneId: string, subscription: PushSubscriptionBody): Promise<void>;
}
