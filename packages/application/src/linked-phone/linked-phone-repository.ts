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
  /** Coupe le lien du téléphone ; sans effet s'il n'en a pas. */
  unlink(phoneId: string): Promise<void>;
}
