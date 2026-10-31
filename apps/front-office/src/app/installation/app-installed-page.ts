import { Component, inject } from '@angular/core';
import { frontOfficeUrls } from '@chimeres/contract';
import { fr } from '@chimeres/design';
import { Button } from '../ui/button';
import { AppInstallation } from './app-installation';

/**
 * « L'application est installée », dans le navigateur, qui reste ouvert après l'installation (#61).
 * « Ouvrir l'application » est un lien du scope dans un nouvel onglet : Android l'ouvre dans
 * l'application, sans onglet de plus. « Rester dans le navigateur » mène à l'Accueil.
 */
@Component({
  selector: 'app-app-installed-page',
  imports: [Button],
  template: `
    <p class="over">C'est fait</p>
    <h1>L'application est installée</h1>
    <p>{{ intro }}</p>
    <p>
      Tu la retrouves sur l'écran d'accueil du téléphone&nbsp;:
      <span class="key">Chimères</span>.
    </p>
    <div class="actions">
      <a appButton="primary" [href]="appUrl" target="_blank">Ouvrir l'application</a>
      <button type="button" appButton="quiet" (click)="installation.stayInBrowser()">
        Rester dans le navigateur
      </button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
      }
    }
  `,
})
export class AppInstalledPage {
  protected readonly installation = inject(AppInstallation);
  protected readonly appUrl = frontOfficeUrls.home();
  protected readonly intro = fr`Continue dans l'application plutôt que dans le navigateur : c'est elle que les notifications ouvrent, avec ta table en premier.`;
}
