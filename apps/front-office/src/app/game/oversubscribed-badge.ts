import { Component } from '@angular/core';
import { Icon } from '../ui/icon';

/** « Très demandée » : les inscrits de la partie dépassent ses places maximum (IN-5). */
@Component({
  selector: 'app-oversubscribed-badge',
  imports: [Icon],
  template: `<app-icon name="triangle-alert" /><span>Très demandée</span>`,
  styles: `
    @layer components {
      :host {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        padding: var(--space-xxs) var(--space-s);
        border-radius: 999px;
        background: color-mix(in srgb, var(--warning) 14%, var(--surface-2));
        color: var(--warning);
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
      }

      app-icon ::ng-deep svg {
        width: 1rem;
        height: 1rem;
      }
    }
  `,
})
export class OversubscribedBadge {}
