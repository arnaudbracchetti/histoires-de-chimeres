import { Component, input } from '@angular/core';
import { Icon } from '../ui/icon';
import type { SettingsPath } from './push-notifications';

/**
 * Le chemin des réglages pour réactiver des notifications bloquées (§4.2) : sur iPhone, les
 * Réglages du téléphone ; dans Chrome, l'icône à gauche de l'adresse ; dans l'application
 * installée sur Android, ses infos.
 */
@Component({
  selector: 'app-blocked-steps',
  imports: [Icon],
  template: `
    <ol class="steps">
      @if (path() === 'iphone') {
        <li>Ouvre les <span class="key"><app-icon name="settings" /> Réglages</span> du téléphone.</li>
        <li>Touche <span class="key">Notifications</span>, puis <span class="key">Chimères</span>.</li>
        <li>Active <span class="key">Autoriser les notifications</span>.</li>
      } @else if (path() === 'installed-app') {
        <li>
          Appuie longuement sur l'icône <span class="key">Chimères</span> de l'écran d'accueil,
          puis touche <span class="key"><app-icon name="info" /><span class="visually-hidden">Infos</span></span>.
        </li>
        <li>Touche <span class="key">Notifications</span> et active-les.</li>
      } @else {
        <li>
          Touche l'icône <span class="key"><app-icon name="settings" /><span class="visually-hidden">Réglages du site</span></span>
          à gauche de l'adresse, en haut du navigateur.
        </li>
        <li>Touche <span class="key">Autorisations</span>, puis active <span class="key">Notifications</span>.</li>
      }
    </ol>
  `,
})
export class BlockedSteps {
  readonly path = input.required<SettingsPath>();
}
