import type { ComparableName } from '../comparable-name.js';

/** MJ : la personne qui mène des parties. Entité de l'agrégat Convention, qui en garde les règles. */
export class GameMaster {
  constructor(
    readonly id: string,
    readonly nickname: ComparableName,
  ) {}
}
