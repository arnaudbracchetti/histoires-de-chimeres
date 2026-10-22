import { Component, inject } from '@angular/core';
import { Icon } from '../icon';
import { Notifications } from './notifications';

/** Les notifications d'erreur, en bas à droite. */
@Component({
  selector: 'app-notification-stack',
  imports: [Icon],
  template: `
    @for (notice of notifications.notices(); track notice.id) {
      <div class="notice" role="alert">
        <div class="text">
          <strong>{{ notice.title }}</strong>
          @if (notice.detail) {
            <p>{{ notice.detail }}</p>
          }
        </div>
        <button
          type="button"
          class="close"
          aria-label="Fermer"
          title="Fermer"
          (click)="notifications.close(notice.id)"
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
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        width: 22rem;
      }

      .notice {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
        padding: var(--space-s) var(--space-m);
        border: 1px solid var(--danger);
        border-radius: var(--radius-control);
        background: var(--surface-2);
      }

      .text {
        flex: 1;
      }

      p {
        color: var(--text-muted);
      }

      .close {
        display: grid;
        place-items: center;
        padding: var(--space-xs);
        border: none;
        border-radius: var(--radius-control);
        background: none;
        color: var(--text-muted);
        cursor: pointer;

        &:hover {
          background: var(--surface-3);
          color: var(--text);
        }
      }
    }
  `,
})
export class NotificationStack {
  protected readonly notifications = inject(Notifications);
}
