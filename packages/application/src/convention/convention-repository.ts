import type { Convention } from '@chimeres/domain';

/** Une sauvegarde partait d'une version périmée : la convention a changé entre-temps. */
export class StaleConventionError extends Error {
  constructor() {
    super('La convention a changé depuis son chargement.');
    this.name = 'StaleConventionError';
  }
}

/** Port d'écriture de la convention. Une base n'en a qu'une, d'où `get()` sans identifiant. */
export interface ConventionRepository {
  get(): Promise<Convention>;
  /**
   * Sauvegarde une convention obtenue par `get()` sur ce même repository. Lève
   * `StaleConventionError` si la version chargée n'est plus celle de la base.
   */
  save(convention: Convention): Promise<void>;
}
