import { HttpErrorResponse } from '@angular/common/http';
import type { ProblemCode, ProblemDto } from '@chimeres/contract';
import type { ErrorNotice } from './shell/alerts';
import { fr } from '@chimeres/design';

/** Ce que le front office lit d'une erreur de l'API (docs/design/patterns.md, Validation). */
export type Problem = {
  /** Le code, pour décider d'un comportement (`convention-ended`), jamais pour écrire un message. */
  code: ProblemCode | null;
  /** Erreurs rattachées à un champ du corps, à afficher sous ce champ. */
  fieldErrors: { field: string; message: string }[];
  /** Erreur sans champ : une alerte, qui ne décale rien dans la page. */
  alert?: ErrorNotice;
};

const INTERNAL_ERROR = 'Une erreur est survenue, réessaie.';
const OFFLINE = fr`Pas de connexion : rien n'a été enregistré.`;

/** Lit l'erreur d'un appel à l'API. Les textes viennent de l'API (ADR 0008), sauf pour un 500 et une coupure. */
export function readProblem(error: unknown): Problem {
  if (!(error instanceof HttpErrorResponse)) {
    // Erreur du front lui-même, pas de l'API : l'alerte reste sobre, la console la garde.
    console.error(error);
    return { code: null, fieldErrors: [], alert: { title: INTERNAL_ERROR } };
  }
  if (error.status === 0) return { code: null, fieldErrors: [], alert: { title: OFFLINE } };
  const problem = error.error as Partial<ProblemDto> | null;
  if (error.status >= 500 || !problem?.code || !problem.title) {
    return { code: null, fieldErrors: [], alert: { title: INTERNAL_ERROR } };
  }
  if (problem.errors?.length) {
    return {
      code: problem.code,
      fieldErrors: problem.errors.map(({ field, message }) => ({ field, message })),
    };
  }
  return {
    code: problem.code,
    fieldErrors: [],
    alert: { title: problem.title, detail: problem.detail },
  };
}
