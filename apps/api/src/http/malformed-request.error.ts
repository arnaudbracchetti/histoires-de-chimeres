/** Le corps n'a pas la forme attendue : un front correct ne provoque jamais cette erreur. */
export class MalformedRequestError extends Error {
  constructor(readonly issues: unknown) {
    super('Corps de requête mal formé.');
    this.name = 'MalformedRequestError';
  }
}
