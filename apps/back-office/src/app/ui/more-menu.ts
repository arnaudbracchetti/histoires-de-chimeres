import { Component, input, output } from '@angular/core';
import { Menu, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { Button } from './button';
import { Icon } from './icon';

/** Une entrée du menu. `danger` l'écrit en rouge brique : « Supprimer le MJ ». */
export type MoreMenuItem = { value: string; label: string; danger?: boolean };

/**
 * Menu « ⋯ » des actions secondaires (docs/design/patterns.md, En-tête de page), sur le motif
 * Menu d'Angular Aria : flèches, Entrée, Échap et focus rendu au bouton viennent d'Aria. Le
 * bouton porte le nom accessible `label` et son infobulle.
 */
@Component({
  selector: 'app-more-menu',
  imports: [Button, Icon, Menu, MenuItem, MenuTrigger],
  template: `
    <button
      type="button"
      appButton="icon"
      ngMenuTrigger
      [menu]="menu"
      [attr.aria-label]="label()"
      [title]="label()"
    >
      <app-icon name="ellipsis" />
    </button>
    <div ngMenu #menu="ngMenu" class="menu" (itemSelected)="onSelected($event)">
      @for (item of items(); track item.value) {
        <div ngMenuItem class="item" [class.danger]="item.danger" [value]="item.value">
          {{ item.label }}
        </div>
      }
    </div>
  `,
  styles: `
    @layer components {
      :host {
        position: relative;
        display: inline-block;
      }

      .menu {
        position: absolute;
        top: calc(100% + var(--space-xs));
        right: 0;
        z-index: 10;
        min-width: 12rem;
        padding: var(--space-xs);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-2);

        &[data-visible='false'] {
          display: none;
        }
      }

      .item {
        padding: var(--space-xs) var(--space-s);
        border-radius: var(--radius-control);
        white-space: nowrap;
        cursor: pointer;

        &[data-active='true'],
        &:hover {
          background: var(--surface-3);
        }

        &.danger {
          color: var(--danger);
        }
      }
    }
  `,
})
export class MoreMenu {
  /** Nom accessible du bouton : « Autres actions sur le MJ ». */
  readonly label = input.required<string>();
  readonly items = input.required<readonly MoreMenuItem[]>();
  readonly selected = output<string>();

  protected onSelected(value: string | undefined): void {
    if (value !== undefined) this.selected.emit(value);
  }
}
