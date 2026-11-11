/** Pseudo inconnu ou mauvais mot de passe : une seule erreur pour les deux (ADR 0018). */
export class WrongCredentialsError extends Error {
  constructor() {
    super('Pseudo ou mot de passe incorrect.');
    this.name = 'WrongCredentialsError';
  }
}
