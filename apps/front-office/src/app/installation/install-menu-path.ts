import { Component, inject, input } from '@angular/core';
import { Icon } from '../ui/icon';
import { BrowserInstall } from './browser-install';

/**
 * Le chemin du menu du navigateur, pour installer sans le bouton « Installer » : en secours sous le
 * bouton, seul quand le navigateur ne l'a pas armé (toujours dans Firefox, qui n'a pas
 * `beforeinstallprompt`). Chrome, Samsung Internet et Firefox ont chacun le leur ; un autre
 * navigateur prend celui de Chrome.
 */
@Component({
  selector: 'app-install-menu-path',
  imports: [Icon],
  template: `
    {{ armed() ? "Si rien ne s'ouvre, ouvre" : 'Ouvre' }} le menu du navigateur
    @switch (browser) {
      @case ('samsung') {
        <span class="key" aria-hidden="true"><app-icon name="menu" /></span>, en bas à droite, puis
        touche <span class="key">Ajouter page à</span>, puis <span class="key">Écran d'accueil</span>.
      }
      @case ('firefox') {
        <span class="key" aria-hidden="true"><app-icon name="ellipsis-vertical" /></span>, puis touche
        <span class="key">Plus</span>, puis
        <span class="key">Ajouter l'application à l'écran d'accueil</span>.
      }
      @default {
        <span class="key" aria-hidden="true"><app-icon name="ellipsis-vertical" /></span>, puis touche
        <span class="key">Ajouter à l'écran d'accueil</span>.
      }
    }
  `,
})
export class InstallMenuPath {
  /** Le bouton « Installer » est affiché au-dessus. */
  readonly armed = input(false);

  protected readonly browser = inject(BrowserInstall).androidBrowser();
}
