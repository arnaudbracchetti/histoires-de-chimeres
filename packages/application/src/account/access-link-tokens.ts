import type { LocalMomentDto } from '@chimeres/contract';

/** Un lien d'accès créé : son jeton, rendu une seule fois, et sa fin de validité. */
export type IssuedAccessLink = { token: string; expiresAt: LocalMomentDto };

/**
 * Port des jetons des liens d'accès (ADR 0018) : 256 bits tirés au hasard. Seule l'empreinte du
 * jeton est gardée ; le jeton n'existe que dans l'URL remise à la personne.
 */
export interface AccessLinkTokens {
  /** Un jeton neuf et son empreinte. */
  generate(): { token: string; tokenHash: string };
  /** L'empreinte d'un jeton reçu, pour retrouver son compte. */
  hash(token: string): string;
}
