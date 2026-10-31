import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Alerts } from './alerts';
import { TabNavigation } from './tab-navigation';

/**
 * Les alertes, en bas de l'écran, à la largeur du contenu (docs/design/patterns-front-office.md,
 * Alertes), au-dessus de la barre des onglets. Une alerte de changement (NO-5) est bordée
 * d'orange, et porte « Voir ».
 */
@Component({
  selector: 'app-alert-stack',
  imports: [Button, Icon],
  template: `
    @for (notice of alerts.notices(); track notice.id) {
      <div class="notice" role="alert" [class.change]="notice.see">
        <div class="text">
          <strong>{{ notice.title }}</strong>
          @if (notice.detail) {
            <p>{{ notice.detail }}</p>
          }
        </div>
        @if (notice.see; as see) {
          <button type="button" appButton="quiet" class="see" (click)="open(notice.id, see)">
            Voir
          </button>
        }
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
        right: var(--gutter);
        bottom: calc(var(--gutter) + var(--alerts-offset, 0px));
        left: var(--gutter);
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        max-width: calc(var(--content-width) - 2 * var(--gutter));
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

        &.change {
          border-color: var(--accent);
        }
      }

      .see {
        flex: none;
        color: var(--accent);
      }

      .text {
        flex: 1;
        padding-top: var(--space-s);
      }

      p {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }
    }
  `,
})
export class AlertStack {
  protected readonly alerts = inject(Alerts);
  private readonly router = inject(Router);
  private readonly navigation = inject(TabNavigation);

  /** « Voir » : l'écran du changement, par l'historique des onglets ; l'alerte se ferme. */
  protected open(id: number, see: string): void {
    this.alerts.close(id);
    const url = this.router.parseUrl(see);
    const path = url.root.children['primary']?.segments.map(({ path }) => path).join('/') ?? '';
    this.navigation.go(path, url.queryParams);
  }
}
