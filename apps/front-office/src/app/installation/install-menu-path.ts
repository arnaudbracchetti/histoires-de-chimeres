import { Component, input } from '@angular/core';
import { Icon } from '../ui/icon';

/**
 * Le chemin du menu du navigateur (⋮ dans Chrome), pour installer sans le bouton « Installer » : en secours sous le
 * bouton, seul quand Chrome ne l'a pas armé (un autre navigateur, par exemple).
 */
@Component({
  selector: 'app-install-menu-path',
  imports: [Icon],
  template: `
    {{ armed() ? "Si rien ne s'ouvre, ouvre" : 'Ouvre' }} le menu du navigateur
    <span class="key" aria-hidden="true"><app-icon name="ellipsis-vertical" /></span>, puis touche
    <span class="key">Ajouter à l'écran d'accueil</span>.
  `,
})
export class InstallMenuPath {
  /** Le bouton « Installer » est affiché au-dessus. */
  readonly armed = input(false);
}
