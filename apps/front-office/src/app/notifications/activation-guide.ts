import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { LinkedPhone } from '../linked-phone';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { BlockedSteps } from './blocked-steps';
import { NotificationBenefits } from './notification-benefits';
import { BENEFITS_INTRO, PERMISSION_PROMPT, WITHOUT_NOTIFICATIONS } from './notification-texts';
import { PushNotifications } from './push-notifications';

/**
 * Le guide d'activation (§4.2), ouvert d'un tap sur le bandeau de NO-6, propre au cas : permission
 * pas donnée (« Activer les notifications »), ou refusée (chemin des réglages). Il monte du bas.
 */
@Component({
  selector: 'app-activation-guide',
  imports: [BlockedSteps, Button, Icon, NotificationBenefits],
  template: `
    @if (push.status() === 'denied') {
      <h2 id="activation-guide-title">Notifications bloquées</h2>
      <p>{{ withoutNotifications }}</p>
      <p>Pour les réactiver&nbsp;:</p>
      <app-blocked-steps [installedApp]="push.installedApp" />
    } @else {
      <h2 id="activation-guide-title">Active les notifications</h2>
      <p>{{ benefitsIntro }}</p>
      <app-notification-benefits [gameMaster]="linkedPhone.gameMaster()" />
      <p class="meta">{{ permissionPrompt }}</p>
      <button type="button" appButton="primary" (click)="activate()">
        <app-icon name="bell" />
        Activer les notifications
      </button>
    }
    <button type="button" appButton="secondary" class="close" (click)="ref.close()">Fermer</button>
  `,
  styles: `
    @layer components {
      :host {
        display: grid;
        width: min(100vw, var(--content-width));
        max-height: 90dvh;
        overflow-y: auto;
        gap: var(--space-m);
        padding: var(--space-xl) var(--gutter) var(--space-l);
        border: 1px solid var(--border);
        border-bottom: none;
        border-radius: var(--radius-card) var(--radius-card) 0 0;
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
    }
  `,
})
export class ActivationGuide {
  protected readonly ref = inject(DialogRef);
  protected readonly push = inject(PushNotifications);
  protected readonly linkedPhone = inject(LinkedPhone);

  protected readonly benefitsIntro = BENEFITS_INTRO;
  protected readonly permissionPrompt = PERMISSION_PROMPT;
  protected readonly withoutNotifications = WITHOUT_NOTIFICATIONS;

  /** La demande du téléphone ; accordée, le guide se ferme, et le bandeau avec lui. */
  protected async activate(): Promise<void> {
    if ((await this.push.activate()) === 'granted') this.ref.close();
  }
}
