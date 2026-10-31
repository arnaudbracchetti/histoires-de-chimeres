import { Component, inject, output } from '@angular/core';
import { fr } from '@chimeres/design';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { AppInstallation } from './app-installation';
import { InstallMenuPath } from './install-menu-path';

/**
 * Sur Android, dans le navigateur, après les notifications : « Installe l'application » (§4.2). Le bouton
 * « Installer » n'est là que si le navigateur l'a armé ; le chemin du menu ⋮ l'accompagne. « Plus tard »
 * mène à l'Accueil, où une carte le rappelle.
 */
@Component({
  selector: 'app-install-app-page',
  imports: [Button, Icon, InstallMenuPath],
  template: `
    <p class="over">Dernière étape</p>
    <h1>Installe l'application</h1>
    <p>{{ intro }}</p>
    <ul>
      <li>
        <app-icon name="circle-check" />
        <span><strong>Ta table</strong> en premier, dès l'ouverture</span>
      </li>
      <li>
        <app-icon name="bell" />
        <span><strong>Les notifications</strong> l'ouvrent directement</span>
      </li>
      <li>
        <app-icon name="house" />
        <span><strong>Plus besoin</strong> de retrouver l'onglet dans le navigateur</span>
      </li>
    </ul>
    <p class="meta"><app-install-menu-path [armed]="installation.armed()" /></p>
    <div class="actions">
      @if (installation.armed()) {
        <button type="button" appButton="primary" (click)="installation.install()">
          <app-icon name="download" />
          Installer
        </button>
      }
      <button type="button" appButton="quiet" (click)="done.emit()">Plus tard</button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      ul {
        display: grid;
        gap: var(--space-s);
        margin: 0;
        padding: 0;
        list-style: none;
        text-align: start;
      }

      li {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
      }

      li app-icon {
        color: var(--accent);
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
export class InstallAppPage {
  /** L'étape est remise à plus tard. L'installation, elle, passe par `justInstalled`. */
  readonly done = output<void>();

  protected readonly installation = inject(AppInstallation);
  protected readonly intro = fr`Elle s'ouvre d'un tap depuis l'écran d'accueil du téléphone, en plein écran, sans passer par le navigateur :`;
}
