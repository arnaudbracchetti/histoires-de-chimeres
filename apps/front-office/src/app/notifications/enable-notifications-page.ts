import { Dialog } from '@angular/cdk/dialog';
import { Component, inject, output, signal } from '@angular/core';
import { fr } from '@chimeres/design';
import { firstValueFrom } from 'rxjs';
import { LinkedPhone } from '../linked-phone';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { BlockedSteps } from './blocked-steps';
import { ContinueWithoutDialog, type ContinueWithoutChoice } from './continue-without-dialog';
import { NotificationBenefits, NotificationExample } from './notification-benefits';
import { BENEFITS_INTRO, PERMISSION_PROMPT } from './notification-texts';
import { PushNotifications } from './push-notifications';

/**
 * Après l'identification, « Active les notifications » (§4.2) : ce qu'elles apportent, un exemple,
 * et le rappel que le téléphone va demander l'autorisation, qui ne vient qu'après le tap. « Plus
 * tard » demande une confirmation ; un refus mène à « Notifications bloquées ».
 */
@Component({
  selector: 'app-enable-notifications-page',
  imports: [BlockedSteps, Button, Icon, NotificationBenefits, NotificationExample],
  template: `
    @if (blocked()) {
      <h1>Notifications bloquées</h1>
      <p>{{ blockedIntro }}</p>
      <app-blocked-steps [installedApp]="push.installedApp" />
      <p class="meta">{{ blockedFallback }}</p>
      <div class="actions">
        <button type="button" appButton="secondary" (click)="done.emit()">Continuer</button>
      </div>
    } @else {
      <p class="over">Dernière étape</p>
      <h1>Active les notifications</h1>
      <p>{{ benefitsIntro }}</p>
      <app-notification-benefits [gameMaster]="linkedPhone.gameMaster()" />
      <app-notification-example [gameMaster]="linkedPhone.gameMaster()" />
      <p class="meta">{{ permissionPrompt }}</p>
      <div class="actions">
        <button type="button" appButton="primary" (click)="activate()">
          <app-icon name="bell" />
          Activer les notifications
        </button>
        <button type="button" appButton="quiet" (click)="later()">Plus tard</button>
      </div>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
      }
    }
  `,
})
export class EnableNotificationsPage {
  /** L'étape est finie : notifications activées, bloquées ou remises à plus tard. */
  readonly done = output<void>();

  protected readonly push = inject(PushNotifications);
  protected readonly linkedPhone = inject(LinkedPhone);
  private readonly dialog = inject(Dialog);

  protected readonly blocked = signal(false);
  protected readonly benefitsIntro = BENEFITS_INTRO;
  protected readonly permissionPrompt = PERMISSION_PROMPT;
  protected readonly blockedIntro = fr`Tu ne recevras ni ta table ni les changements du programme. Pour réactiver les notifications :`;
  protected readonly blockedFallback = fr`Sinon, reviens voir l'application après chaque tirage : ta table s'y affiche en premier. Un bandeau te le rappellera sur chaque écran.`;

  /** La demande du téléphone. Fermée sans réponse, elle laisse l'écran tel quel. */
  protected async activate(): Promise<void> {
    const permission = await this.push.activate();
    if (permission === 'granted') this.done.emit();
    else if (permission === 'denied') this.blocked.set(true);
  }

  /** « Plus tard » : la confirmation, qui propose d'abord de les activer. Fermée, rien ne change. */
  protected async later(): Promise<void> {
    const ref = this.dialog.open<ContinueWithoutChoice>(ContinueWithoutDialog, {
      role: 'alertdialog',
      ariaLabelledBy: 'continue-without-title',
      backdropClass: 'scrim',
      restoreFocus: true,
    });
    const choice = await firstValueFrom(ref.closed);
    if (choice === 'activate') await this.activate();
    else if (choice === 'continue') this.done.emit();
  }
}
