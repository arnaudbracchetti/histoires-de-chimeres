/** Changer son mot de passe : le mot de passe actuel saisi est faux (ADR 0019). */
export class CurrentPasswordWrongError extends Error {
  constructor() {
    super('Mot de passe actuel incorrect.');
    this.name = 'CurrentPasswordWrongError';
  }
}
