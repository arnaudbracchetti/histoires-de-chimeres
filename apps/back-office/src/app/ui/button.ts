import { Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'quiet-danger' | 'icon' | 'danger';

/**
 * Bouton natif dessiné selon la charte (docs/design/patterns.md, Boutons) :
 * `<button appButton="primary">`, ou un lien qui en a l'allure (`<a appButton>`). Le destructeur
 * plein ne sert que dans un dialogue de confirmation ; hors dialogue, « Supprimer » est discret,
 * en rouge brique (`quiet-danger`). Un bouton à icône seule (`icon`) porte son nom accessible et
 * son infobulle.
 */
@Component({
  selector: 'button[appButton], a[appButton]',
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
        text-decoration: none;
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

      :host(.quiet-danger) {
        padding-inline: var(--space-xs);
        color: var(--danger);

        &:hover {
          filter: brightness(1.15);
        }
      }

      :host(.icon) {
        display: inline-grid;
        place-items: center;
        padding: var(--space-xs);
        color: var(--text-muted);

        &:hover {
          background: var(--surface-3);
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
