import { booleanAttribute, Component, computed, input, output } from '@angular/core';
import type { AccountRole } from '@chimeres/contract';
import { Icon } from '../ui/icon';

const ROLES: Record<AccountRole, { icon: string; label: string; help: string; color: string }> = {
  'game-master': {
    icon: 'dices',
    label: 'MJ',
    help: 'Saisit ses scénarios et ses disponibilités.',
    color: 'var(--role-game-master)',
  },
  organizer: {
    icon: 'settings',
    label: 'Organisateur',
    help: 'Tous les droits du back office.',
    color: 'var(--role-organizer)',
  },
};

/**
 * Un rôle du back office en carte à cocher (ID-16, docs/design/patterns.md, Fiche d'un pseudo) :
 * cochée, elle prend la couleur du rôle, fond à 14 %, bordure à 45 %. Le contenu projeté complète
 * l'aide. `pressed` reçoit le clic sur la case : l'onglet « Compte » l'annule, pour ne cocher
 * qu'avec la fiche relue.
 */
@Component({
  selector: 'app-role-card',
  imports: [Icon],
  template: `
    <label [class.on]="checked()" [style.--role]="details().color">
      <input
        type="checkbox"
        [checked]="checked()"
        [disabled]="disabled()"
        (click)="pressed.emit($event)"
      />
      <app-icon [name]="details().icon" />
      <span class="text">
        <strong>{{ details().label }}</strong>
        <span class="help">{{ details().help }} <ng-content /></span>
      </span>
    </label>
  `,
  styles: `
    @layer components {
      label {
        display: flex;
        gap: var(--space-s);
        align-items: center;
        padding: var(--space-s) var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        cursor: pointer;

        &:has(input:disabled) {
          cursor: default;
        }

        > app-icon {
          color: var(--text-muted);
        }

        &.on {
          border-color: color-mix(in srgb, var(--role) 45%, transparent);
          background: color-mix(in srgb, var(--role) 14%, var(--surface-2));

          > app-icon,
          strong {
            color: var(--role);
          }
        }
      }

      .text {
        display: flex;
        flex-direction: column;
      }

      .help {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class RoleCard {
  readonly role = input.required<AccountRole>();
  readonly checked = input.required<boolean>();
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly pressed = output<MouseEvent>();

  protected readonly details = computed(() => ROLES[this.role()]);
}
