import { Component, input } from '@angular/core';

/** Bandeau d'erreur en haut d'un formulaire, pour une erreur de l'API sans champ. */
@Component({
  selector: 'app-form-alert',
  template: `
    @if (message()) {
      <p role="alert">{{ message() }}</p>
    }
  `,
  styles: `
    @layer components {
      p {
        padding: var(--space-s) var(--space-m);
        border: 1px solid var(--danger);
        border-radius: var(--radius-control);
        background: var(--surface-2);
      }
    }
  `,
})
export class FormAlert {
  readonly message = input<string>();
}
