import type { ComparableName } from '../comparable-name.js';

/**
 * Participant : la personne qui s'identifie par son pseudo sur un téléphone (ID-1). Entité de
 * l'agrégat Convention, qui en garde les règles. Son pseudo ne se modifie pas (ID-9).
 */
export class Participant {
  constructor(
    readonly id: string,
    readonly nickname: ComparableName,
  ) {}
}
