import { Component, computed, input, output } from '@angular/core';
import type {
  ReserveScenarioDto,
  ScheduleScenarioDto,
  TimeSlotTrackingDto,
  VerdictRefusalDto,
} from '@chimeres/contract';
import { countOf, formatCount, formatTimeSlotRanks, fr } from '@chimeres/design';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { ScenarioIllustration } from '../ui/scenario-illustration';
import { TwoSlotBadge } from '../ui/two-slot-badge';

/** Un scénario de la réserve du créneau, et son motif, ou `null` s'il y est programmable. */
type ReserveCard = { scenario: ReserveScenarioDto; refusal: VerdictRefusalDto | null };

/**
 * L'onglet « Réserve du créneau » (docs/design/patterns.md, Pilotage du jour J) : combien de
 * scénarios y sont programmables, puis une carte par scénario, dans l'ordre reçu. Un scénario non
 * programmable est atténué, avec la phrase de son motif ; les autres offrent « Programmer ici… ».
 */
@Component({
  selector: 'app-tracked-reserve-panel',
  imports: [Button, Icon, ScenarioIllustration, TwoSlotBadge],
  template: `
    @if (cards().length) {
      <p>{{ heading() }}</p>
      <ul>
        @for (card of cards(); track card.scenario.id) {
          @let scenario = card.scenario;
          <li [class.unschedulable]="card.refusal">
            <app-scenario-illustration
              format="thumb"
              [title]="scenario.title"
              [imageUrl]="scenario.imageUrl"
            />
            <h3 [id]="'slot-reserve-' + scenario.id">{{ scenario.title }}</h3>
            <span class="meta">{{ scenario.system }} · {{ scenario.gameMaster.nickname }}</span>
            @if (scenario.duration === 2) {
              <app-two-slot-badge />
            }
            <div class="foot">
              @if (card.refusal; as refusal) {
                <p class="reason">{{ refusal.detail }}</p>
              }
              @if (scheduledRanks(scenario); as ranks) {
                <p class="scheduled">
                  <app-icon name="circle-check" />Déjà programmé&nbsp;: {{ ranks }}
                </p>
              }
              @if (!card.refusal) {
                <button
                  type="button"
                  appButton="secondary"
                  [attr.aria-describedby]="'slot-reserve-' + scenario.id"
                  (click)="scheduleOn.emit(scenario)"
                >
                  Programmer ici…
                </button>
              }
            </div>
          </li>
        }
      </ul>
    } @else {
      <p>Aucun scénario en réserve sur ce créneau.</p>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      p {
        margin: 0;
        color: var(--text-muted);
      }

      ul {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
        gap: var(--space-s);
        align-items: start;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      /* Vignette, titre et méta en tête ; le pied court sur toute la largeur de la carte. */
      li {
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
      }

      h3 {
        grid-area: title;
        align-self: end;
        margin: 0;
        overflow: hidden;
        font-family: var(--font-ui);
        font-size: var(--font-size-body);
        font-weight: 600;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .meta {
        grid-area: meta;
        align-self: start;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

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

        > button {
          margin-left: auto;
        }
      }

      .reason {
        flex-basis: 100%;
        font-size: var(--font-size-meta);
      }

      .scheduled {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        color: var(--success);
        font-size: var(--font-size-meta);
        white-space: nowrap;
      }

      /* Atténué : pas programmable ici. Son motif, lui, reste lisible. */
      .unschedulable {
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
export class TrackedReservePanel {
  readonly timeSlot = input.required<TimeSlotTrackingDto>();
  /** Dans l'ordre de la journée : ils donnent le rang des créneaux où un scénario est programmé. */
  readonly timeSlots = input.required<readonly TimeSlotTrackingDto[]>();
  /** La réserve, comme dans le programme. */
  readonly reserve = input.required<readonly ReserveScenarioDto[]>();

  readonly scheduleOn = output<ScheduleScenarioDto>();

  /** La réserve du créneau, dans l'ordre reçu. */
  protected readonly cards = computed(() =>
    this.timeSlot().reserve.flatMap(({ scenarioId, refusal }): ReserveCard[] => {
      const scenario = this.reserve().find(({ id }) => id === scenarioId);
      return scenario ? [{ scenario, refusal }] : [];
    }),
  );

  /** « 4 scénarios programmables sur ce créneau, 5 autres en réserve. » */
  protected readonly heading = computed(() => {
    const schedulable = this.cards().filter(({ refusal }) => !refusal).length;
    const others = this.cards().length - schedulable;
    if (!schedulable) {
      return fr`Aucun scénario programmable sur ce créneau, ${formatCount(others)} en réserve.`;
    }
    const rest = others ? fr`, ${countOf(others, 'autre', 'autres')} en réserve` : '';
    return fr`${countOf(schedulable, 'scénario programmable', 'scénarios programmables')} sur ce créneau${rest}.`;
  });

  /**
   * « créneau 1 », « créneaux 1 et 3 » : les autres créneaux où le scénario est programmé, ou `''`.
   * Le second créneau d'une partie double peut être celui-ci.
   */
  protected scheduledRanks({ timeSlots }: ReserveScenarioDto): string {
    return formatTimeSlotRanks(
      timeSlots
        .filter(({ timeSlotId, scheduled }) => scheduled && timeSlotId !== this.timeSlot().id)
        .map(({ timeSlotId }) => this.timeSlots().find(({ id }) => id === timeSlotId)?.rank ?? 0),
    );
  }
}
