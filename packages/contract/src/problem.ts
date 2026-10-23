/**
 * Codes de refus du domaine, avec leurs paramètres (ADR 0008). Le domaine déclare la même carte,
 * et `application` vérifie à la compilation qu'elles concordent.
 */
export type RefusalParams = {
  'convention-name-required': Record<string, never>;
  'convention-name-too-long': { max: number };
  'time-slot-not-found': Record<string, never>;
  'time-slot-end-not-after-start': Record<string, never>;
  /** `rank` : le rang du créneau chevauché. */
  'time-slot-start-overlaps': { rank: number };
  'time-slot-end-overlaps': { rank: number };
  /** `rank` : le rang du créneau ; `availabilities` : le nombre de MJ disponibles dessus. */
  'time-slot-hours-locked': { rank: number; availabilities: number };
  /** `rank` : le rang du créneau ; `games` : le nombre de parties qu'il porte. */
  'time-slot-has-games': { rank: number; games: number };
  'table-not-found': Record<string, never>;
  'table-name-required': Record<string, never>;
  'table-name-too-long': { max: number };
  /** `name` : le nom de la table qui le porte déjà, tel qu'il s'affiche. */
  'table-name-taken': { name: string };
  /** `name` : le nom de la table ; `games` : le nombre de parties qu'elle porte. */
  'table-has-games': { name: string; games: number };
  'game-master-not-found': Record<string, never>;
  'nickname-required': Record<string, never>;
  'nickname-too-long': { max: number };
  /** `nickname` : le pseudo du MJ qui le porte déjà, tel qu'il s'affiche. */
  'nickname-taken': { nickname: string };
  /** `scenarios` : le nombre de scénarios du MJ. */
  'game-master-has-scenarios': { scenarios: number };
  /** `nickname` : le pseudo du MJ ; `rank` : le rang du créneau. */
  'game-master-unavailable': { nickname: string; rank: number };
  'game-master-busy': { nickname: string; rank: number };
  /** `nickname` : le pseudo du MJ, dont un scénario n'est en réserve sur aucun créneau (PR-6). */
  'game-master-without-availability': { nickname: string };
  'game-master-busy-everywhere': { nickname: string };
  /** `table` : le nom de la table ; `rank` : le rang du créneau. */
  'table-taken': { table: string; rank: number };
  'scenario-not-found': Record<string, never>;
  'scenario-title-required': Record<string, never>;
  'scenario-title-too-long': { max: number };
  'system-required': Record<string, never>;
  'system-too-long': { max: number };
  'presentation-required': Record<string, never>;
  'presentation-too-long': { max: number };
  'content-warnings-too-long': { max: number };
  'seats-min-below-one': Record<string, never>;
  /** Le maximum est sous le minimum. */
  'seats-out-of-order': Record<string, never>;
};

export type RefusalCode = keyof RefusalParams;

/** Codes que seule l'API produit. */
export type ApiErrorCode =
  | 'malformed-request'
  | 'concurrent-modification'
  | 'image-too-large'
  | 'image-format-unsupported'
  | 'image-unreadable'
  | 'image-not-found'
  | 'internal-error';

export type ProblemCode = RefusalCode | ApiErrorCode;

/** Erreur rattachée à un champ du corps (`seats.min` pour un champ imbriqué). */
export type FieldErrorDto = {
  field: string;
  code: ProblemCode;
  message: string;
};

/** Problem Details (RFC 9457), servi en `application/problem+json`, avec les extensions `code` et `errors`. */
export type ProblemDto = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: ProblemCode;
  errors?: FieldErrorDto[];
};
