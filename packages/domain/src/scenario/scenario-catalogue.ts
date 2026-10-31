import { Refusal } from '../refusal.js';
import type { Duration } from './scenario.js';

/** Un scénario du catalogue : seulement ce que les règles des autres agrégats en lisent. */
export type CatalogueEntry = {
  id: string;
  gameMasterId: string;
  duration: Duration;
  /** Les places maximum, celles de ses parties (PR-4). */
  maxSeats: number;
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

  listEntries(): readonly CatalogueEntry[] {
    return this.all;
  }

  /** L'entrée du scénario, qui doit exister : le catalogue est entier. */
  findExistingEntryById(scenarioId: string): CatalogueEntry {
    const entry = this.all.find(({ id }) => id === scenarioId);
    if (!entry) throw new Refusal('scenario-not-found', {});
    return entry;
  }

  /** Nombre de scénarios du MJ. */
  countScenariosOfGameMaster(gameMasterId: string): number {
    return this.all.filter((entry) => entry.gameMasterId === gameMasterId).length;
  }
}
