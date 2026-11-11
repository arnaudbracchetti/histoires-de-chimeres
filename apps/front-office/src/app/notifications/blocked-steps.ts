import { Component, input } from '@angular/core';
import { Icon } from '../ui/icon';
import type { SettingsPath } from './push-notifications';

/**
 * Le chemin des réglages pour réactiver des notifications bloquées (§4.2) : sur iPhone, les
 * Réglages du téléphone ; dans l'application installée sur Android, ses infos ; dans le navigateur,
 * ses réglages du site (Samsung Internet : son menu ; Firefox : le cadenas à gauche de l'adresse ;
 * Chrome et les autres : l'icône à gauche de l'adresse).
 */
@Component({
  selector: 'app-blocked-steps',
  imports: [Icon],
  template: `
    <ol class="steps">
      @switch (path()) {
        @case ('iphone') {
          <li>Ouvre les <span class="key"><app-icon name="settings" /> Réglages</span> du téléphone.</li>
          <li>Touche <span class="key">Notifications</span>, puis <span class="key">Chimères</span>.</li>
          <li>Active <span class="key">Autoriser les notifications</span>.</li>
        }
        @case ('installed-app') {
          <li>
            Appuie longuement sur l'icône <span class="key">Chimères</span> de l'écran d'accueil,
            puis touche <span class="key"><app-icon name="info" /><span class="visually-hidden">Infos</span></span>.
          </li>
          <li>Touche <span class="key">Notifications</span> et active-les.</li>
        }
        @case ('samsung') {
          <li>
            Ouvre le menu du navigateur
            <span class="key"><app-icon name="menu" /><span class="visually-hidden">Menu</span></span>, en bas
            à droite, puis touche <span class="key"><app-icon name="settings" />Paramètres</span>.
          </li>
          <li>
            Touche <span class="key">Sites et téléchargements</span>, puis
            <span class="key">Autorisations du site</span>.
          </li>
          <li>Touche <span class="key">Notifications</span>, puis autorise ce site.</li>
        }
        @case ('firefox') {
          <li>
            Touche l'icône <span class="key"><app-icon name="lock" /><span class="visually-hidden">Cadenas</span></span>
            à gauche de l'adresse.
          </li>
          <li>Sous <span class="key">Autorisations</span>, active <span class="key">Notifications</span>.</li>
        }
        @default {
          <li>
            Touche l'icône <span class="key"><app-icon name="settings" /><span class="visually-hidden">Réglages du site</span></span>
            à gauche de l'adresse, en haut du navigateur.
          </li>
          <li>Touche <span class="key">Autorisations</span>, puis active <span class="key">Notifications</span>.</li>
        }
      }
    </ol>
  `,
})
export class BlockedSteps {
  readonly path = input.required<SettingsPath>();
}
