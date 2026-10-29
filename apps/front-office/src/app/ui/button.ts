import { Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'icon';

/**
 * Bouton natif dessiné selon la charte, à la taille du pouce : `<button appButton="primary">`, ou un
 * lien qui en a l'allure (`<a appButton>`). Un bouton à icône seule (`icon`) porte son nom
 * accessible.
 */
@Component({
  selector: 'button[appButton], a[appButton]',
  host: { '[class]': 'appButton()' },
  template: `<ng-content />`,
  styles: `
    @layer components {
      :host {
        display: inline-flex;
        gap: var(--space-s);
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 var(--space-l);
        border: 1px solid transparent;
        border-radius: var(--radius-control);
        background: none;
        color: var(--text);
        font-weight: 600;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
      }

      :host(.primary) {
        background: var(--accent);
        color: var(--on-accent);
      }

      :host(.secondary) {
        border-color: var(--border);
        background: var(--surface-3);
      }

      :host(.quiet) {
        padding-inline: var(--space-s);
        color: var(--accent);
      }

      :host(.icon) {
        display: inline-grid;
        place-items: center;
        width: 44px;
        min-height: 44px;
        padding: 0;
        border-radius: 999px;
        color: var(--text-muted);
      }
    }
  `,
})
export class Button {
  readonly appButton = input<ButtonVariant>('secondary');
}
