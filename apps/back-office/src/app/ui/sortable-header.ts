import { Component, computed, input } from '@angular/core';
import { Icon } from './icon';
import type { SortControl } from './table-view';

/**
 * En-tête de colonne triable (docs/design/patterns.md, Tableaux) : `<th appSortable="title"
 * [view]="view">Titre</th>`. Le libellé est un bouton qui trie par `view.sortBy()` ; `aria-sort`
 * et la flèche ne sont posés que sur la colonne triée.
 */
@Component({
  selector: 'th[appSortable]',
  imports: [Icon],
  host: { scope: 'col', '[attr.aria-sort]': 'view().ariaSort(appSortable())' },
  template: `
    <button type="button" (click)="view().sortBy(appSortable())">
      <ng-content />
      @if (direction(); as direction) {
        <app-icon [name]="direction === 'descending' ? 'arrow-down' : 'arrow-up'" />
      }
    </button>
  `,
  styles: `
    @layer components {
      button {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
    }
  `,
})
export class SortableHeader {
  /** La colonne, telle que la nomment les `sortKeys` de `tableView()`. */
  readonly appSortable = input.required<string>();
  readonly view = input.required<SortControl>();

  protected readonly direction = computed(() => this.view().ariaSort(this.appSortable()));
}
