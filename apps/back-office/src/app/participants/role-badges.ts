import { Component, input } from '@angular/core';
import { Icon } from '../ui/icon';

/**
 * Les rôles d'un pseudo en badges, icône et libellé (ID-16, docs/design/jetons.md) : MJ en violet,
 * Organisateur en turquoise, et « Participant » en gris quand il n'a aucun rôle.
 */
@Component({
  selector: 'app-role-badges',
  imports: [Icon],
  template: `
    @if (roles().gameMaster) {
      <span class="badge game-master"><app-icon name="dices" />MJ</span>
    }
    @if (roles().organizer) {
      <span class="badge organizer"><app-icon name="settings" />Organisateur</span>
    }
    @if (!roles().gameMaster && !roles().organizer) {
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
        gap: var(--space-xs);
        align-items: center;
        padding: 0 var(--space-s);
        border: 1px solid color-mix(in srgb, var(--role) 45%, transparent);
        border-radius: 999px;
        background: color-mix(in srgb, var(--role) 14%, var(--surface-2));
        color: var(--role);
        font-size: var(--font-size-meta);
        font-weight: 600;
        white-space: nowrap;
      }

      .game-master {
        --role: var(--role-game-master);
      }

      .organizer {
        --role: var(--role-organizer);
      }

      .participant {
        --role: var(--role-participant);
        font-weight: 400;
      }
    }
  `,
})
export class RoleBadges {
  readonly roles = input.required<{ gameMaster: boolean; organizer: boolean }>();
}
