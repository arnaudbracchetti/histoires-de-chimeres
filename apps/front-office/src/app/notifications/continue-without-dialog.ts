import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { fr } from '@chimeres/design';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { WITHOUT_NOTIFICATIONS } from './notification-texts';

/** Ce que rend « Continuer sans notifications ? » : rien si on le ferme sans choisir. */
export type ContinueWithoutChoice = 'activate' | 'continue';

/**
 * « Continuer sans notifications ? », ouvert par « Plus tard » (§4.2) : il redit ce qu'on perd, et
 * propose d'abord de les activer.
 */
@Component({
  selector: 'app-continue-without-dialog',
  imports: [Button, Icon],
  template: `
    <h2 id="continue-without-title">Continuer sans notifications ?</h2>
    <p>{{ withoutNotifications }}</p>
    <p class="meta">{{ reminder }}</p>
    <div class="actions">
      <button type="button" appButton="primary" (click)="ref.close('activate')">
        <app-icon name="bell" />
        Activer les notifications
      </button>
      <button type="button" appButton="secondary" (click)="ref.close('continue')">
        Continuer sans
      </button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: grid;
        width: calc(min(100vw, var(--content-width)) - 2 * var(--gutter));
        gap: var(--space-m);
        padding: var(--space-xl) var(--space-l) var(--space-l);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-3);
      }

      h2 {
        font-family: var(--font-ui);
        font-size: var(--font-size-mobile-section);
        font-weight: 600;
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }

      .actions {
        display: grid;
        gap: var(--space-s);
      }
    }
  `,
})
export class ContinueWithoutDialog {
  protected readonly ref = inject<DialogRef<ContinueWithoutChoice>>(DialogRef);

  protected readonly withoutNotifications = WITHOUT_NOTIFICATIONS;
  protected readonly reminder = fr`Un bandeau te le rappellera sur chaque écran ; tu pourras les activer plus tard.`;
}
