import { Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

/**
 * Bouton natif dessiné selon la charte (docs/design/patterns.md, Boutons) :
 * `<button appButton="primary">`. Le destructeur ne sert que dans un dialogue de confirmation.
 */
@Component({
  selector: 'button[appButton]',
  host: { '[class]': 'appButton()' },
  template: `<ng-content />`,
  styles: `
    @layer components {
      :host {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        padding: var(--space-xs) var(--space-m);
        border: 1px solid transparent;
        border-radius: var(--radius-control);
        background: none;
        color: var(--text);
        cursor: pointer;
        transition: background-color 150ms;
      }

      :host(.primary) {
        background: var(--accent);
        color: var(--on-accent);

        &:hover {
          filter: brightness(1.1);
        }
      }

      :host(.secondary) {
        border-color: var(--border);

        &:hover {
          background: var(--surface-3);
        }
      }

      :host(.quiet) {
        padding-inline: var(--space-xs);
        color: var(--text-muted);

        &:hover {
          color: var(--text);
        }
      }

      :host(.danger) {
        background: var(--danger-fill);

        &:hover {
          filter: brightness(1.1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        :host {
          transition: none;
        }
      }
    }
  `,
})
export class Button {
  readonly appButton = input.required<ButtonVariant>();
}
