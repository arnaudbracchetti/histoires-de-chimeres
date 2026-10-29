import { afterNextRender, inject, Injector } from '@angular/core';
import {
  isFieldTree,
  type FieldTree,
  type FormSubmitOptions,
  type ValidationError,
} from '@angular/forms/signals';
import { readProblem, type Problem } from '../problem';
import { Alerts, type ErrorNotice } from '../shell/alerts';

/**
 * L'envoi d'un formulaire (docs/design/patterns.md, Validation), à passer en `submission` de
 * `form()`, dans le même contexte d'injection : `write` enregistre, et lance l'erreur de l'API
 * telle quelle. Une erreur rattachée à un champ s'affiche sous ce champ, le reste en alerte, et le
 * focus va au premier champ en erreur, refus de l'API comme erreur locale. Un second envoi pendant
 * le premier est refusé par `submit()`.
 */
export function submitWith<TModel>(
  write: () => Promise<unknown>,
): FormSubmitOptions<TModel, unknown> {
  const alerts = inject(Alerts);
  const injector = inject(Injector);
  const focusFirstError = (form: FieldTree<TModel>) =>
    afterNextRender(() => form().errorSummary()[0]?.fieldTree().focusBoundControl(), {
      injector,
    });
  return {
    action: async (form) => {
      try {
        await write();
        return undefined;
      } catch (error) {
        const { errors, alert } = toSubmissionErrors(readProblem(error), form);
        if (alert) alerts.error(alert);
        focusFirstError(form);
        return errors;
      }
    },
    onInvalid: focusFirstError,
  };
}

/** Chaque erreur de champ sur le champ que nomme son `field`. Une erreur dont le champ n'est pas dans le formulaire passe en alerte. */
function toSubmissionErrors(
  problem: Problem,
  form: FieldTree<unknown>,
): { errors: ValidationError.WithFieldTree[]; alert?: ErrorNotice } {
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
  return { errors, alert: problem.alert ?? orphan };
}
