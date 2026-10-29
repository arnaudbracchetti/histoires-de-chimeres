import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { fr } from '@chimeres/design';
import { Confirmation } from '../ui/confirmation';

/** Une page qui peut avoir des modifications non enregistrées. */
export interface UnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Garde de sortie d'une page à formulaire, comme celle d'un scénario (docs/design/patterns.md,
 * Enregistrement) : « Quitter sans enregistrer ? », seulement s'il reste des modifications non
 * enregistrées.
 */
export const leaveUnsaved: CanDeactivateFn<UnsavedChanges> = (page) =>
  !page.hasUnsavedChanges() ||
  inject(Confirmation).ask({
    question: fr`Quitter sans enregistrer ?`,
    consequence: 'Tes modifications seront perdues.',
    confirmLabel: 'Quitter sans enregistrer',
    action: async () => undefined,
  });
