import { afterNextRender, inject, Injector } from '@angular/core';
import {
  isFieldTree,
  type FieldTree,
  type FormSubmitOptions,
  type ValidationError,
} from '@angular/forms/signals';
import { readProblem, type FormProblem } from '../problem';
import { ErrorDialog, type ErrorNotice } from '../shell/error-dialog';

export type SubmitOptions = {
  /** Appelé avant le focus au premier champ en erreur : pour montrer un champ masqué. */
  beforeFocus?: () => void;
};

/**
 * L'envoi d'un formulaire (docs/design/patterns.md, Validation), à passer en `submission` de
 * `form()`, dans le même contexte d'injection : `write` enregistre, et lance l'erreur de l'API
 * telle quelle. Une erreur rattachée à un champ s'affiche sous ce champ, le reste dans le dialogue d'erreur,
 * et le focus va au premier champ en erreur, refus de l'API comme erreur locale. Un second envoi
 * pendant le premier est refusé par `submit()`.
 */
export function submitWith<TModel>(
  write: () => Promise<unknown>,
  { beforeFocus }: SubmitOptions = {},
): FormSubmitOptions<TModel, unknown> {
  const errorDialog = inject(ErrorDialog);
  const injector = inject(Injector);
  const focusFirstError = (form: FieldTree<TModel>) => {
    beforeFocus?.();
    afterNextRender(() => form().errorSummary()[0]?.fieldTree().focusBoundControl(), {
      injector,
    });
  };
  return {
    action: async (form) => {
      try {
        await write();
        return undefined;
      } catch (error) {
        const { errors, notice } = toSubmissionErrors(readProblem(error), form);
        if (notice) void errorDialog.open(notice);
        focusFirstError(form);
        return errors;
      }
    },
    onInvalid: focusFirstError,
  };
}

/**
 * Chaque erreur de champ sur le champ que nomme son `field` (`seats.min` → `form.seats.min`). Une
 * erreur dont le champ n'est pas dans le formulaire passe dans le dialogue d'erreur.
 */
function toSubmissionErrors(
  problem: FormProblem,
  form: FieldTree<unknown>,
): { errors: ValidationError.WithFieldTree[]; notice?: ErrorNotice } {
  const errors: ValidationError.WithFieldTree[] = [];
  const orphans: string[] = [];
  for (const { field, message } of problem.fieldErrors) {
    const fieldTree = field
      .split('.')
      .reduce<unknown>((tree, key) => (tree as Record<string, unknown> | undefined)?.[key], form);
    if (isFieldTree(fieldTree)) errors.push({ kind: 'server', message, fieldTree });
    else orphans.push(message);
  }
  const orphan = orphans.length ? { title: orphans.join(' ') } : undefined;
  return { errors, notice: problem.notice ?? orphan };
}
