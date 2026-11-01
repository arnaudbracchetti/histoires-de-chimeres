import { Component, input } from '@angular/core';
import type {
  ReserveScenarioDto,
  ScheduleScenarioDto,
  TimeSlotDto,
  VerdictRefusalDto,
} from '@chimeres/contract';
import { formatTimeSlotRanks } from '@chimeres/design';
import { ScenarioIllustration } from './scenario-illustration';
import { TwoSlotBadge } from './two-slot-badge';

/**
 * La carte d'un scénario de la réserve (docs/design/patterns.md, Bac de réserve), dans le
 * Calendrier comme dans le pilotage : vignette, titre et méta en tête, badge « double » ; dessous,
 * sur toute la largeur, la phrase du motif s'il n'est pas programmable (la carte est alors
 * atténuée), les pastilles (`app-reserve-pastille`, ou leur liste) puis le bouton, calé à droite.
 */
@Component({
  selector: 'app-reserve-scenario-card',
  imports: [ScenarioIllustration, TwoSlotBadge],
  host: { '[class.unschedulable]': 'refusal()' },
  template: `
    <app-scenario-illustration [title]="scenario().title" [imageUrl]="scenario().imageUrl" />
    <h3 [id]="titleId()">{{ scenario().title }}</h3>
    <p class="meta">{{ scenario().system }} · {{ scenario().gameMaster.nickname }}</p>
    @if (scenario().duration === 2) {
      <app-two-slot-badge />
    }
    <div class="foot">
      @if (refusal(); as refusal) {
        <p class="reason">{{ refusal.detail }}</p>
      }
      <ng-content />
      <span class="action"><ng-content select="button" /></span>
    </div>
  `,
  styles: `
    @layer components {
      /*
       * Vignette, titre et méta en tête ; le pied court sur toute la largeur de la carte. Le bouton
       * s'y cale à droite, et passe à la ligne plutôt que de recouvrir les pastilles.
       */
      :host {
        display: grid;
        grid-template-areas:
          'thumb title badge'
          'thumb meta badge'
          'foot foot foot';
        grid-template-columns: 44px minmax(0, 1fr) auto;
        gap: var(--space-xs) var(--space-s);
        align-items: center;
        padding: var(--space-s);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-1);
      }

      app-scenario-illustration {
        grid-area: thumb;
        width: 44px;
      }

      h3 {
        grid-area: title;
        align-self: end;
        font-family: var(--font-ui);
        font-size: var(--font-size-body);
        font-weight: 600;
      }

      .meta {
        grid-area: meta;
        align-self: start;
      }

      h3,
      .meta {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      /* Le badge « double », en haut à droite, à côté du titre. */
      app-two-slot-badge {
        grid-area: badge;
        align-self: start;
      }

      .foot {
        display: flex;
        grid-area: foot;
        flex-wrap: wrap;
        gap: var(--space-xs) var(--space-s);
        align-items: center;
      }

      .action {
        margin-left: auto;

        &:empty {
          display: none;
        }
      }

      p {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .reason {
        flex-basis: 100%;
      }

      /* Atténuée : pas programmable. Son motif, lui, reste lisible. */
      :host(.unschedulable) {
        app-scenario-illustration {
          opacity: 0.5;
          filter: grayscale(1);
        }

        h3 {
          color: var(--text-muted);
        }
      }
    }
  `,
})
export class ReserveScenarioCard {
  readonly scenario = input.required<ScheduleScenarioDto>();
  /** Le motif de la carte atténuée, ou `null` si le scénario est programmable. */
  readonly refusal = input<VerdictRefusalDto | null>(null);
  /** L'id du titre : le bouton de la carte s'en sert pour son `aria-describedby`. */
  readonly titleId = input.required<string>();
}

/**
 * « créneau 1 », « créneaux 2, 3 et 4 » : les créneaux où le scénario est programmé, ou en réserve,
 * hors `exceptTimeSlotId`. `''` s'il n'y en a aucun.
 */
export function formatReserveRanks(
  { timeSlots }: ReserveScenarioDto,
  state: 'scheduled' | 'inReserve',
  daySlots: readonly Pick<TimeSlotDto, 'id' | 'rank'>[],
  exceptTimeSlotId?: string,
): string {
  return formatTimeSlotRanks(
    timeSlots
      .filter((slot) => slot[state] && slot.timeSlotId !== exceptTimeSlotId)
      .map(({ timeSlotId }) => daySlots.find(({ id }) => id === timeSlotId)?.rank ?? 0),
  );
}
