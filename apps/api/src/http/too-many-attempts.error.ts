/**
 * Trop d'essais depuis la même adresse IP : codes de présence faux (ID-2), ou essais de connexion
 * au back office (ADR 0018). 429.
 */
export class TooManyAttemptsError extends Error {
  constructor(
    readonly code: 'too-many-attempts' | 'too-many-login-attempts' = 'too-many-attempts',
  ) {
    super(code);
    this.name = 'TooManyAttemptsError';
  }
}
