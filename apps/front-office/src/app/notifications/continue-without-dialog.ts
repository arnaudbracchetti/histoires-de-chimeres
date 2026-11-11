import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { fr } from '@chimeres/design';
import { firstValueFrom } from 'rxjs';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { WITHOUT_NOTIFICATIONS } from './notification-texts';

/**
 * Ce que propose d'abord « Continuer sans notifications ? » : les activer, ou, sur iPhone dans le
 * navigateur, installer l'application.
 */
export type ContinueWithoutOffer = 'activate' | 'install';

/** Ce que rend « Continuer sans notifications ? » : rien si on le ferme sans choisir. */
export type ContinueWithoutChoice = ContinueWithoutOffer | 'continue';

/** Le premier bouton et le rappel, selon ce que le dialogue propose d'abord. */
const OFFERS = {
  activate: {
    icon: 'bell',
    label: 'Activer les notifications',
    reminder: fr`Un bandeau te le rappellera sur chaque écran ; tu pourras les activer plus tard.`,
  },
  install: {
    icon: 'square-plus',
    label: "Installer l'application",
    reminder: fr`Un bandeau te le rappellera sur chaque écran ; tu pourras ajouter l'application plus tard.`,
  },
} as const;

/** Ouvre « Continuer sans notifications ? » et rend le choix : rien s'il est fermé sans choisir. */
export function askContinueWithout(
  dialog: Dialog,
  offer: ContinueWithoutOffer,
): Promise<ContinueWithoutChoice | undefined> {
  const ref = dialog.open<ContinueWithoutChoice, ContinueWithoutOffer>(ContinueWithoutDialog, {
    data: offer,
    role: 'alertdialog',
    ariaLabelledBy: 'continue-without-title',
    backdropClass: 'scrim',
    restoreFocus: true,
  });
  return firstValueFrom(ref.closed);
}

/**
 * « Continuer sans notifications ? », ouvert par « Plus tard » ou par « Continuer dans Safari »
 * (§4.2) : il redit ce qu'on perd, et propose d'abord de les activer, ou d'installer l'application.
 */
@Component({
  selector: 'app-continue-without-dialog',
  imports: [Button, Icon],
  template: `
    <h2 id="continue-without-title">Continuer sans notifications ?</h2>
    <p>{{ withoutNotifications }}</p>
    <p class="meta">{{ text.reminder }}</p>
    <div class="actions">
      <button type="button" appButton="primary" (click)="ref.close(offer)">
        <app-icon [name]="text.icon" />
        {{ text.label }}
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
  protected readonly offer = inject<ContinueWithoutOffer>(DIALOG_DATA);
  protected readonly text = OFFERS[this.offer];

  protected readonly withoutNotifications = WITHOUT_NOTIFICATIONS;
}
