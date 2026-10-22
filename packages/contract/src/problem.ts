/**
 * Codes de refus du domaine, avec leurs paramètres (ADR 0008). Le domaine déclare la même carte,
 * et `application` vérifie à la compilation qu'elles concordent.
 */
export type RefusalParams = {
  'convention-name-required': Record<string, never>;
  'convention-name-too-long': { max: number };
};

export type RefusalCode = keyof RefusalParams;

/** Codes que seule l'API produit. */
export type ApiErrorCode = 'malformed-request' | 'concurrent-modification' | 'internal-error';

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
