import { Component, computed, input } from '@angular/core';
import { Icon } from '../ui/icon';
import { ACCESS_STATES, accessLabel, accessState, type Person } from './accounts-store';

/**
 * PROTOTYPE JETABLE (#169) : les rôles en badges de couleur, l'état du compte en pastille.
 * Couleurs des rôles provisoires (violet MJ, turquoise Organisateur) : hors des couleurs de statut
 * de la charte, pour ne pas les confondre avec un état. À reprendre en jetons si retenu.
 */
@Component({
  selector: 'app-proto-role-badges',
  imports: [Icon],
  template: `
    @if (person().gameMaster) {
      <span class="badge game-master"><app-icon name="dices" />MJ</span>
    }
    @if (person().organizer) {
      <span class="badge organizer"><app-icon name="settings" />Organisateur</span>
    }
    @if (!person().gameMaster && !person().organizer && showParticipant()) {
      <span class="badge participant"><app-icon name="user-round" />Participant</span>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
        vertical-align: middle;
      }

      .badge {
        display: inline-flex;
        gap: 0.3em;
        align-items: center;
        padding: 0.1em 0.6em;
        border: 1px solid color-mix(in srgb, var(--role) 45%, transparent);
        border-radius: 999px;
        background: color-mix(in srgb, var(--role) 16%, transparent);
        color: var(--role);
        font-size: var(--font-size-meta);
        font-weight: 600;
        white-space: nowrap;

        app-icon {
          width: 0.85em;
          height: 0.85em;
        }
      }

      .game-master {
        --role: #b69cff;
      }

      .organizer {
        --role: #4fd1c5;
      }

      .participant {
        --role: var(--text-muted);
        font-weight: 400;
      }
    }
  `,
})
export class RoleBadges {
  readonly person = input.required<Person>();
  /** Montre « Participant » quand la personne n'a aucun rôle. */
  readonly showParticipant = input(true);
}

/** L'état du compte : pastille (icône + libellé) dans un tableau, ou bandeau dans l'onglet. */
@Component({
  selector: 'app-proto-access-status',
  imports: [Icon],
  host: {
    '[class.banner]': 'banner()',
    '[style.--state]': 'config()?.color',
    '[class.hidden]': '!config()',
  },
  template: `
    @if (config(); as config) {
      <app-icon [name]="config.icon" />
      <span class="text">
        <span class="label">{{ label() }}</span>
        @if (banner()) {
          <span class="help">{{ config.help }}</span>
        }
      </span>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        color: var(--state);
        font-size: var(--font-size-meta);
      }

      :host(.hidden) {
        display: none;
      }

      .label {
        font-weight: 600;
      }

      :host(.banner) {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
        padding: var(--space-s) var(--space-m);
        border-left: 4px solid var(--state);
        border-radius: var(--radius-control);
        background: color-mix(in srgb, var(--state) 14%, transparent);
        font-size: inherit;

        app-icon {
          margin-top: 0.2em;
        }

        .text {
          display: flex;
          flex-direction: column;
        }

        .help {
          color: var(--text);
          font-size: var(--font-size-meta);
        }
      }
    }
  `,
})
export class AccessStatus {
  readonly person = input.required<Person>();
  readonly banner = input(false);
  protected readonly config = computed(() => {
    const state = accessState(this.person());
    return state === 'none' ? undefined : ACCESS_STATES[state];
  });
  protected readonly label = computed(() => accessLabel(this.person()));
}
