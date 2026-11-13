/** Le serveur n'a pas d'adresse publique (`PUBLIC_URL`) : aucun lien d'accès ne se construit (503). */
export class PublicUrlMissingError extends Error {
  constructor() {
    super('public-url-missing');
    this.name = 'PublicUrlMissingError';
  }
}
