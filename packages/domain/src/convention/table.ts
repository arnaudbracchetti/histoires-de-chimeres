import type { ComparableName } from '../comparable-name.js';

/** Table : l'emplacement physique où se joue une partie. Entité de l'agrégat Convention, qui en garde les règles. */
export class Table {
  constructor(
    readonly id: string,
    readonly name: ComparableName,
  ) {}
}
