import { Component, input } from '@angular/core';
import { Icon } from '../ui/icon';

/**
 * Le chemin des réglages pour réactiver des notifications bloquées (§4.2) : dans Chrome, l'icône
 * à gauche de l'adresse ; dans l'application installée sur Android, ses infos.
 */
@Component({
  selector: 'app-blocked-steps',
  imports: [Icon],
  template: `
    <ol>
      @if (installedApp()) {
        <li>
          Appuie longuement sur l'icône <span class="key">Chimères</span> de l'écran d'accueil,
          puis touche <span class="key"><app-icon name="info" /><span class="visually-hidden">Infos</span></span>.
        </li>
        <li>Touche <span class="key">Notifications</span> et active-les.</li>
      } @else {
        <li>
          Touche l'icône <span class="key"><app-icon name="settings" /><span class="visually-hidden">Réglages du site</span></span>
          à gauche de l'adresse, en haut de Chrome.
        </li>
        <li>Touche <span class="key">Autorisations</span>, puis active <span class="key">Notifications</span>.</li>
      }
    </ol>
  `,
  styles: `
    @layer components {
      ol {
        display: grid;
        gap: var(--space-s);
        margin: 0;
        padding-inline-start: var(--space-l);
        text-align: start;
      }

      .key {
        display: inline-flex;
        gap: var(--space-xxs);
        align-items: center;
        padding: 0 var(--space-xs);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-3);
        font-weight: 600;
        vertical-align: middle;
      }
    }
  `,
})
export class BlockedSteps {
  readonly installedApp = input(false);
}
