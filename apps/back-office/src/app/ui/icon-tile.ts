import { Component, input } from '@angular/core';
import { Icon } from '../icon';

/**
 * Icône de carte (docs/design/patterns.md) : une icône orange sur un carré arrondi, en tête des
 * cartes de créneau (sablier) et de table (dés). Décorative.
 */
@Component({
  selector: 'app-icon-tile',
  imports: [Icon],
  template: `<app-icon [name]="name()" />`,
  styles: `
    @layer components {
      :host {
        display: inline-grid;
        flex: none;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: var(--radius-control);
        background: var(--surface-3);
        color: var(--accent);
      }
    }
  `,
})
export class IconTile {
  readonly name = input.required<string>();
}
