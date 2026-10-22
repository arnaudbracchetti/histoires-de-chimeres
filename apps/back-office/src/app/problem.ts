import { HttpErrorResponse } from '@angular/common/http';
import { isFieldTree, type FieldTree, type ValidationError } from '@angular/forms/signals';
import type { ProblemDto } from '@chimeres/contract';

/** Ce qu'un formulaire affiche d'une écriture refusée (docs/design/patterns.md, Validation). */
export type FormProblem = {
  /** Erreurs rattachées à un champ du corps, à afficher sous ce champ. */
  fieldErrors: { field: string; message: string }[];
  /** Message du bandeau, pour une erreur sans champ. */
  alert?: string;
};

const INTERNAL_ERROR = 'Une erreur est survenue, réessaie.';
const OFFLINE = "Pas de connexion : rien n'a été enregistré.";

/** Lit l'erreur d'un `apiCall()`. Les textes viennent de l'API (ADR 0008), sauf pour un 500 et une coupure. */
export function readProblem(error: unknown): FormProblem {
  if (!(error instanceof HttpErrorResponse)) return { fieldErrors: [], alert: INTERNAL_ERROR };
  if (error.status === 0) return { fieldErrors: [], alert: OFFLINE };
  const problem = error.error as Partial<ProblemDto> | null;
  if (error.status >= 500 || !problem?.title) return { fieldErrors: [], alert: INTERNAL_ERROR };
  if (problem.errors?.length) {
    return {
      fieldErrors: problem.errors.map(({ field, message }) => ({ field, message })),
    };
  }
  return { fieldErrors: [], alert: problem.detail ?? problem.title };
}

/**
 * Erreurs de champ pour `submit()` de Signal Forms : chacune sur le champ que nomme son `field`
 * (`seats.min` → `form.seats.min`). Une erreur dont le champ n'est pas dans le formulaire passe au bandeau.
 */
export function toSubmissionErrors(
  problem: FormProblem,
  form: FieldTree<unknown>,
): { errors: ValidationError.WithFieldTree[]; alert?: string } {
  const errors: ValidationError.WithFieldTree[] = [];
  const orphans: string[] = [];
  for (const { field, message } of problem.fieldErrors) {
    const fieldTree = field
      .split('.')
      .reduce<unknown>((tree, key) => (tree as Record<string, unknown> | undefined)?.[key], form);
    if (isFieldTree(fieldTree)) errors.push({ kind: 'server', message, fieldTree });
    else orphans.push(message);
  }
  return { errors, alert: problem.alert ?? (orphans.join(' ') || undefined) };
}

/** Met le focus au premier champ en erreur. */
export function focusFirstError(form: FieldTree<unknown>): void {
  form().errorSummary()[0]?.fieldTree().focusBoundControl();
}
