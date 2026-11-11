import { Component, inject } from '@angular/core';
import { Icon } from '../ui/icon';
import { BrowserInstall } from './browser-install';

/**
 * L'ajout à l'écran d'accueil sur iPhone, en quatre étapes (§4.2, NO-6) : le seul moyen d'y
 * recevoir les notifications. La première dépend du navigateur, qui place « Partager » à sa façon ;
 * les suivantes passent par la feuille de partage d'iOS. Libellés à relever sur un iPhone (#60).
 */
@Component({
  selector: 'app-home-screen-steps',
  imports: [Icon],
  template: `
    <ol class="steps">
      @switch (browser) {
        @case ('chrome') {
          <li>
            Touche <span class="key"><app-icon name="share" />Partager</span>, à droite de
            l'adresse, en haut de l'écran.
          </li>
        }
        @case ('firefox') {
          <li>
            Touche <span class="key"><app-icon name="menu" /><span class="visually-hidden">Menu</span></span>
            en bas à droite, puis <span class="key"><app-icon name="share" />Partager</span>.
          </li>
        }
        @default {
          <li>
            Touche <span class="key"><app-icon name="share" />Partager</span>, en bas de l'écran. Si
            tu ne le vois pas, touche d'abord
            <span class="key"><app-icon name="ellipsis" /><span class="visually-hidden">Plus</span></span>.
          </li>
        }
      }
      <li>
        Touche <span class="key"><app-icon name="square-plus" />Sur l'écran d'accueil</span>. Fais
        défiler la liste si tu ne le vois pas.
      </li>
      <li>Touche <span class="key">Ajouter</span>, en haut à droite.</li>
      <li>Ouvre <span class="key">Chimères</span> depuis l'écran d'accueil du téléphone.</li>
    </ol>
  `,
})
export class HomeScreenSteps {
  protected readonly browser = inject(BrowserInstall).iPhoneBrowser();
}
