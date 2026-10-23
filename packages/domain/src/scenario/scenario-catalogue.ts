import type { Duration } from './scenario.js';

/** Un scénario du catalogue : seulement ce que les règles des autres agrégats en lisent. */
export type CatalogueEntry = {
  id: string;
  gameMasterId: string;
  duration: Duration;
};

/**
 * Le catalogue des scénarios de la convention, toujours entier, sans présentations ni images. Le
 * repository est le seul à le fournir : un catalogue partiel fausserait les règles qui l'interrogent
 * (ADR 0005).
 */
export class ScenarioCatalogue {
  private constructor(private readonly all: readonly CatalogueEntry[]) {}

  static restore(entries: readonly CatalogueEntry[]): ScenarioCatalogue {
    return new ScenarioCatalogue([...entries]);
  }

  entries(): readonly CatalogueEntry[] {
    return this.all;
  }

  /** Nombre de scénarios du MJ. */
  countOf(gameMasterId: string): number {
    return this.all.filter((entry) => entry.gameMasterId === gameMasterId).length;
  }
}
