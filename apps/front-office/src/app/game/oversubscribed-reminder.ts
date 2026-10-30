import { Component, computed, input } from '@angular/core';
import { Icon } from '../ui/icon';
import { oversubscribedReminderOf } from './game-text';

/**
 * Le rappel d'IN-5, sur fond jaune teinté : la seule inscription du créneau est une partie très
 * demandée. Dans Mes parties, et sur la ligne du créneau dans l'Accueil.
 */
@Component({
  selector: 'app-oversubscribed-reminder',
  imports: [Icon],
  template: `<app-icon name="triangle-alert" /><span>{{ text() }}</span>`,
  styles: `
    @layer components {
      :host {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
        padding: var(--space-m);
        border-radius: var(--radius-card);
        background: color-mix(in srgb, var(--warning) 14%, var(--surface-2));
      }

      app-icon {
        color: var(--warning);
      }
    }
  `,
})
export class OversubscribedReminder {
  /** Le rang du créneau. */
  readonly rank = input.required<number>();

  protected readonly text = computed(() => oversubscribedReminderOf(this.rank()));
}
