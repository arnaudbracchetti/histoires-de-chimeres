import { HttpErrorResponse } from '@angular/common/http';
import type { ProblemCode, ProblemDto } from '@chimeres/contract';

/** Ce que le front office lit d'une erreur de l'API : son code, et la phrase à afficher. */
export type Problem = { code: ProblemCode | null; message: string };

const INTERNAL_ERROR = 'Une erreur est survenue, réessaie.';
const OFFLINE = 'Pas de connexion : réessaie quand le réseau passe.';

/** Les textes viennent de l'API (ADR 0008), sauf pour un 500 et une coupure. */
export function readProblem(error: unknown): Problem {
  if (!(error instanceof HttpErrorResponse)) {
    console.error(error);
    return { code: null, message: INTERNAL_ERROR };
  }
  if (error.status === 0) return { code: null, message: OFFLINE };
  const problem = error.error as Partial<ProblemDto> | null;
  if (error.status >= 500 || !problem?.code || !problem.title) {
    return { code: null, message: INTERNAL_ERROR };
  }
  return {
    code: problem.code,
    message: problem.errors?.[0]?.message ?? problem.detail ?? problem.title,
  };
}
