import { Component, input } from '@angular/core';
import type { TrackedGameDto } from '@chimeres/contract';
import { Icon } from '../ui/icon';
import { TwoSlotBadge } from '../ui/two-slot-badge';

/**
 * Les badges d'une partie suivie (docs/design/patterns.md, Statuts) : « double », « Très demandée »
 * (neutre) et « Sous son minimum » (jaune), d'après les drapeaux reçus, sans recalcul.
 */
@Component({
  selector: 'app-game-badges',
  imports: [Icon, TwoSlotBadge],
  template: `
    @if (game().timeSlotIds.length > 1) {
      <app-two-slot-badge />
    }
    @if (game().oversubscribed) {
      <span class="badge"><app-icon name="users" />Très demandée</span>
    }
    @if (game().belowMinimum) {
      <span class="badge warning"><app-icon name="triangle-alert" />Sous son minimum</span>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }

      .badge {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        padding: 0 var(--space-s);
        border-radius: 999px;
        background: var(--surface-3);
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .badge.warning {
        background: color-mix(in srgb, var(--warning) 14%, transparent);
        color: var(--warning);
      }
    }
  `,
})
export class GameBadges {
  readonly game = input.required<TrackedGameDto>();
}
