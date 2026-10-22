/**
 * Codes de refus du domaine, avec leurs paramètres. `contract` déclare la même carte, que l'API
 * traduit en messages (ADR 0008) ; `application` vérifie à la compilation qu'elles concordent.
 */
export type RefusalParams = {
  'convention-name-required': Record<string, never>;
  'convention-name-too-long': { max: number };
  'time-slot-not-found': Record<string, never>;
  'time-slot-end-not-after-start': Record<string, never>;
  /** `rank` : le rang du créneau chevauché. */
  'time-slot-start-overlaps': { rank: number };
  'time-slot-end-overlaps': { rank: number };
  'table-not-found': Record<string, never>;
  'table-name-required': Record<string, never>;
  'table-name-too-long': { max: number };
  /** `name` : le nom de la table qui le porte déjà, tel qu'il s'affiche. */
  'table-name-taken': { name: string };
};

export type RefusalCode = keyof RefusalParams;

/** Refus d'une règle du domaine : un code et des paramètres, sans texte. */
export class Refusal<C extends RefusalCode = RefusalCode> extends Error {
  constructor(
    readonly code: C,
    readonly params: RefusalParams[C],
  ) {
    super(code);
    this.name = 'Refusal';
  }
}
