import { Component } from '@angular/core';
import { Icon } from './icon';

/**
 * Le badge neutre « double » d'une partie ou d'un scénario de deux créneaux (docs/design/patterns.md,
 * Statuts) : icône et libellé, en pilule. Sa place dans la carte revient au parent.
 */
@Component({
  selector: 'app-two-slot-badge',
  imports: [Icon],
  template: `<app-icon name="columns-2" />double`,
  styles: `
    @layer components {
      :host {
        display: inline-flex;
        flex: none;
        gap: var(--space-xs);
        align-items: center;
        padding: 0 var(--space-s);
        border-radius: 999px;
        background: var(--surface-3);
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class TwoSlotBadge {}
