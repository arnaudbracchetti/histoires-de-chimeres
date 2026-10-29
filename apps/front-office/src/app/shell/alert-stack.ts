import { Component, inject } from '@angular/core';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Alerts } from './alerts';

/** Les alertes, en bas de l'écran, sur toute sa largeur. */
@Component({
  selector: 'app-alert-stack',
  imports: [Button, Icon],
  template: `
    @for (notice of alerts.notices(); track notice.id) {
      <div class="notice" role="alert">
        <div class="text">
          <strong>{{ notice.title }}</strong>
          @if (notice.detail) {
            <p>{{ notice.detail }}</p>
          }
        </div>
        <button
          type="button"
          appButton="icon"
          aria-label="Fermer"
          title="Fermer"
          (click)="alerts.close(notice.id)"
        >
          <app-icon name="x" />
        </button>
      </div>
    }
  `,
  styles: `
    @layer components {
      :host {
        position: fixed;
        right: var(--space-l);
        bottom: var(--space-l);
        left: var(--space-l);
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        max-width: 448px;
        margin-inline: auto;
      }

      .notice {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
        padding: var(--space-s) var(--space-xs) var(--space-s) var(--space-m);
        border: 1px solid var(--danger);
        border-radius: var(--radius-control);
        background: var(--surface-2);
        text-align: left;
      }

      .text {
        flex: 1;
        padding-top: var(--space-s);
      }

      p {
        color: var(--text-muted);
      }
    }
  `,
})
export class AlertStack {
  protected readonly alerts = inject(Alerts);
}
