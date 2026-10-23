import { HttpErrorResponse } from '@angular/common/http';
import type { ProblemDto } from '@chimeres/contract';
import type { ErrorNotice } from './shell/notifications';

/** Ce qu'un formulaire affiche d'une écriture refusée (docs/design/patterns.md, Validation). */
export type FormProblem = {
  /** Erreurs rattachées à un champ du corps, à afficher sous ce champ. */
  fieldErrors: { field: string; message: string }[];
  /** Erreur sans champ : une notification, qui ne décale rien dans la page. */
  alert?: ErrorNotice;
};

const INTERNAL_ERROR = 'Une erreur est survenue, réessaie.';
const OFFLINE = "Pas de connexion : rien n'a été enregistré.";

/** Lit l'erreur d'un `apiCall()`. Les textes viennent de l'API (ADR 0008), sauf pour un 500 et une coupure. */
export function readProblem(error: unknown): FormProblem {
  if (!(error instanceof HttpErrorResponse)) {
    // Erreur du front lui-même, pas de l'API : la notification reste sobre, la console la garde.
    console.error(error);
    return { fieldErrors: [], alert: { title: INTERNAL_ERROR } };
  }
  if (error.status === 0) return { fieldErrors: [], alert: { title: OFFLINE } };
  const problem = error.error as Partial<ProblemDto> | null;
  if (error.status >= 500 || !problem?.title) {
    return { fieldErrors: [], alert: { title: INTERNAL_ERROR } };
  }
  if (problem.errors?.length) {
    return {
      fieldErrors: problem.errors.map(({ field, message }) => ({ field, message })),
    };
  }
  return { fieldErrors: [], alert: { title: problem.title, detail: problem.detail } };
}
