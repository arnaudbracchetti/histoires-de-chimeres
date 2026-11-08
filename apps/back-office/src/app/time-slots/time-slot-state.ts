import { Component, input } from '@angular/core';
import type { TimeSlotStateDto } from '@chimeres/contract';
import { Icon } from '../ui/icon';

/** Le libellé et l'icône de chaque état d'un créneau (docs/design/patterns.md, Statuts). */
export const TIME_SLOT_STATES: Record<TimeSlotStateDto, { label: string; icon: string }> = {
  'sign-ups-open': { label: 'Inscriptions ouvertes', icon: 'lock-open' },
  drawing: { label: 'Tirage provisoire', icon: 'hourglass' },
  published: { label: 'Tirage publié', icon: 'lock' },
  ended: { label: 'Terminé', icon: 'check' },
};

/**
 * L'état d'un créneau, en pastille : son icône et son libellé, dans sa couleur. Le libellé dit
 * l'état sans la couleur, lecteur d'écran compris.
 */
@Component({
  selector: 'app-time-slot-state',
  imports: [Icon],
  template: `<span class="state" [attr.data-time-slot-state]="state()"
    ><app-icon [name]="states[state()].icon" />{{ states[state()].label }}</span
  >`,
  styles: `
    @layer components {
      /* Sa couleur vient de son état (styles.css). */
      .state {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        color: var(--time-slot-state);
      }
    }
  `,
})
export class TimeSlotState {
  readonly state = input.required<TimeSlotStateDto>();

  protected readonly states = TIME_SLOT_STATES;
}
