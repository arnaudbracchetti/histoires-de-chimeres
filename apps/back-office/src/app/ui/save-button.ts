import { Component, effect, input, signal } from '@angular/core';
import { Button } from './button';

/** Durée de « Enregistré » à côté du bouton. */
const SAVED_MS = 3000;

/**
 * « Enregistrer », bouton principal d'un formulaire de page, jamais désactivé. Pendant l'envoi,
 * il passe en « Enregistrement… » (le second envoi est refusé par `submit()`), puis « Enregistré »
 * s'affiche quelques secondes à côté (docs/design/patterns.md, Enregistrement).
 */
@Component({
  selector: 'app-save-button',
  imports: [Button],
  template: `
    <button type="submit" appButton="primary">
      {{ submitting() ? 'Enregistrement…' : 'Enregistrer' }}
    </button>
    @if (saved()) {
      <span class="saved">Enregistré</span>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        gap: var(--space-s);
        align-items: center;
      }

      .saved {
        color: var(--success);
      }
    }
  `,
})
export class SaveButton {
  readonly submitting = input.required<boolean>();
  /** Instant du dernier enregistrement réussi : « Enregistré » s'affiche à chaque changement. */
  readonly savedAt = input<number>();

  protected readonly saved = signal(false);

  constructor() {
    effect((onCleanup) => {
      if (this.savedAt() === undefined) return;
      this.saved.set(true);
      const timer = setTimeout(() => this.saved.set(false), SAVED_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
