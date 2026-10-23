import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { Confirmation } from '../ui/confirmation';

/** Une page qui peut avoir des modifications non enregistrées. */
export interface UnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Garde de sortie d'une page de scénario (docs/design/patterns.md, Enregistrement) : « Quitter
 * sans enregistrer ? », seulement s'il reste des modifications non enregistrées.
 */
export const leaveUnsaved: CanDeactivateFn<UnsavedChanges> = (page) =>
  !page.hasUnsavedChanges() ||
  inject(Confirmation).ask({
    question: 'Quitter sans enregistrer ?',
    consequence: 'Tes modifications seront perdues.',
    confirmLabel: 'Quitter sans enregistrer',
    action: async () => undefined,
  });
