/** Une session du back office sans le droit que demande l'endpoint (ADR 0017) : 403. */
export class AccessDeniedError extends Error {
  constructor() {
    super('access-denied');
    this.name = 'AccessDeniedError';
  }
}
