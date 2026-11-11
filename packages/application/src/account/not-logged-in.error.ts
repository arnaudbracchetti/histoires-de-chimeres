/** Aucune session du back office : cookie absent, inconnu ou expiré (ADR 0019). */
export class NotLoggedInError extends Error {
  constructor() {
    super('Aucune session du back office.');
    this.name = 'NotLoggedInError';
  }
}
