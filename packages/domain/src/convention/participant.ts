import type { ComparableName } from '../comparable-name.js';

/**
 * Participant : la personne qui s'identifie par son pseudo sur un téléphone (ID-1). Entité de
 * l'agrégat Convention, qui en garde les règles. Un MJ en est un aussi (ADR 0012). Le participant
 * ne modifie pas son pseudo (ID-9) ; seul un Organisateur renomme celui d'un MJ (PR-12).
 */
export class Participant {
  constructor(
    readonly id: string,
    readonly nickname: ComparableName,
  ) {}
}
