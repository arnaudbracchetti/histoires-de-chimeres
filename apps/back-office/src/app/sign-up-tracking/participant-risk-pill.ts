import { Component, computed, input } from '@angular/core';
import type { ParticipantRiskDto } from '@chimeres/contract';
import { Icon } from '../ui/icon';

/** La pastille de chaque risque : son libellé, son icône et sa couleur (docs/design/patterns.md, Statuts). */
const RISKS: Record<ParticipantRiskDto, { label: string; icon: string; tone: string }> = {
  'may-not-be-placed': {
    label: 'Risque de ne pas être placé',
    icon: 'octagon-alert',
    tone: 'danger',
  },
  'may-be-left-without-table': {
    label: 'Risque de rester sans table',
    icon: 'triangle-alert',
    tone: 'warning',
  },
};

/** La pastille du risque d'un participant, reçu de l'API : icône et libellé, en ligne. */
@Component({
  selector: 'app-participant-risk-pill',
  imports: [Icon],
  template: `
    <span class="pill" [class]="pill().tone"><app-icon [name]="pill().icon" />{{ pill().label }}</span>
  `,
  styles: `
    @layer components {
      .pill {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        font-size: var(--font-size-meta);
      }

      .danger {
        color: var(--danger);
      }

      .warning {
        color: var(--warning);
      }
    }
  `,
})
export class ParticipantRiskPill {
  readonly risk = input.required<ParticipantRiskDto>();

  protected readonly pill = computed(() => RISKS[this.risk()]);
}
