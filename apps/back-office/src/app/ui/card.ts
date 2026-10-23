import { booleanAttribute, Component, input } from '@angular/core';

/**
 * Cadre d'une carte de saisie (docs/design/patterns.md, Créneaux et Tables) : filet, fond, et en
 * saisie la bordure orange et le halo. `dimmed` estompe la carte pendant la saisie d'une autre.
 * `cardId` sert à y rendre le focus. La mise en page du contenu revient à la liste.
 */
@Component({
  selector: 'article[appCard]',
  host: {
    class: 'card',
    '[class.editing]': 'editing()',
    '[class.dimmed]': 'dimmed()',
    '[attr.data-card]': 'cardId()',
  },
  template: `<ng-content />`,
  styles: `
    @layer components {
      :host {
        position: relative;
        display: flex;
        min-width: 0;
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-1);
        transition: opacity 150ms;
      }

      :host(.editing) {
        border-color: var(--accent);
        box-shadow: var(--halo);
      }

      :host(.dimmed) {
        opacity: 0.45;
      }

      @media (prefers-reduced-motion: reduce) {
        :host {
          transition: none;
        }
      }
    }
  `,
})
export class Card {
  readonly editing = input(false, { transform: booleanAttribute });
  readonly dimmed = input(false, { transform: booleanAttribute });
  readonly cardId = input<string>();
}

/** Carte en pointillés qui ouvre une carte de saisie : « + Ajouter un créneau ». */
@Component({
  selector: 'button[appAddCard]',
  host: { class: 'add', type: 'button', '[class.dimmed]': 'dimmed()' },
  template: `<span aria-hidden="true">+</span> <ng-content />`,
  styles: `
    @layer components {
      :host {
        border: 1px dashed var(--border);
        border-radius: var(--radius-card);
        background: none;
        color: var(--text-muted);
        cursor: pointer;
        transition: opacity 150ms;

        &:hover {
          border-color: var(--accent);
          color: var(--text);
        }
      }

      :host(.dimmed) {
        opacity: 0.45;
      }

      @media (prefers-reduced-motion: reduce) {
        :host {
          transition: none;
        }
      }
    }
  `,
})
export class AddCard {
  readonly dimmed = input(false, { transform: booleanAttribute });
}
