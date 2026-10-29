/** Le téléphone n'est relié à aucun pseudo : cookie absent, inconnu ou coupé (ADR 0009). */
export class PhoneNotLinkedError extends Error {
  constructor() {
    super("Ce téléphone n'est relié à aucun pseudo.");
    this.name = 'PhoneNotLinkedError';
  }
}
