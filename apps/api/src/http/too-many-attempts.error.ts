/** Trop de codes de présence faux depuis la même adresse IP (ID-2) : 429. */
export class TooManyAttemptsError extends Error {
  constructor() {
    super('too-many-attempts');
    this.name = 'TooManyAttemptsError';
  }
}
