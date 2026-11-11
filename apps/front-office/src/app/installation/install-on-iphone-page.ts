import { Dialog } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { fr } from '@chimeres/design';
import { askContinueWithout } from '../notifications/continue-without-dialog';
import { NotificationBenefits } from '../notifications/notification-benefits';
import { Button } from '../ui/button';
import { BrowserInstall } from './browser-install';
import { HomeScreenFirst } from './home-screen-first';
import { HomeScreenSteps } from './home-screen-steps';
import { IPHONE_BROWSER_NAMES } from './iphone-browser';
import { RetypeReminder } from './retype-reminder';

/**
 * Sur iPhone, dans le navigateur, avant le pseudo : « Installe l'application » (§4.2, stories 31
 * à 34). À quoi servent les notifications, l'ajout à l'écran d'accueil en quatre étapes, et le code
 * de présence à retaper dans l'application. Continuer dans le navigateur, sans notifications, passe
 * par une confirmation.
 */
@Component({
  selector: 'app-install-on-iphone-page',
  imports: [Button, HomeScreenSteps, NotificationBenefits, RetypeReminder],
  template: `
    <p class="over">Avant tout</p>
    <h1>Installe l'application</h1>
    <p>{{ intro }}</p>
    <app-notification-benefits />
    <app-home-screen-steps />
    <app-retype-reminder />
    <button type="button" appButton="quiet" (click)="continueInBrowser()">
      Continuer dans {{ browserName }}, sans notifications
    </button>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }
    }
  `,
})
export class InstallOnIPhonePage {
  private readonly homeScreenFirst = inject(HomeScreenFirst);
  private readonly dialog = inject(Dialog);

  protected readonly browserName = IPHONE_BROWSER_NAMES[inject(BrowserInstall).iPhoneBrowser()];
  protected readonly intro = fr`Sur iPhone, les notifications n'arrivent que dans l'application ajoutée à l'écran d'accueil. C'est par elles qu'elle te tient au courant :`;

  /** La confirmation, qui propose d'abord d'installer. Fermée ou « Installer », l'écran reste. */
  protected async continueInBrowser(): Promise<void> {
    const choice = await askContinueWithout(this.dialog, 'install');
    if (choice === 'continue') this.homeScreenFirst.continueInBrowser();
  }
}
