import { Component, computed, input, output } from '@angular/core';
import type {
  ReserveScenarioDto,
  ScheduleScenarioDto,
  TimeSlotTrackingDto,
  VerdictRefusalDto,
} from '@chimeres/contract';
import { countOf, formatCount, fr } from '@chimeres/design';
import { Button } from '../ui/button';
import { ReservePastille } from '../ui/reserve-pastille';
import { formatReserveRanks, ReserveScenarioCard } from '../ui/reserve-scenario-card';

/** Un scénario de la réserve du créneau, et son motif, ou `null` s'il y est programmable. */
type ReserveCard = { scenario: ReserveScenarioDto; refusal: VerdictRefusalDto | null };

/**
 * L'onglet « Réserve du créneau » (docs/design/patterns.md, Pilotage du jour J) : combien de
 * scénarios y sont programmables, puis une carte par scénario, dans l'ordre reçu, comme dans le bac
 * de réserve. Un scénario non programmable est atténué, avec la phrase de son motif ; les autres
 * offrent « Programmer ici… ».
 */
@Component({
  selector: 'app-tracked-reserve-panel',
  imports: [Button, ReservePastille, ReserveScenarioCard],
  template: `
    @if (cards().length) {
      <p>{{ heading() }}</p>
      <ul>
        @for (card of cards(); track card.scenario.id) {
          @let scenario = card.scenario;
          <li>
            <app-reserve-scenario-card
              [scenario]="scenario"
              [refusal]="card.refusal"
              [titleId]="'slot-reserve-' + scenario.id"
            >
              @if (scheduledRanks(scenario); as ranks) {
                <app-reserve-pastille scheduled
                  >Déjà programmé&nbsp;: {{ ranks }}</app-reserve-pastille
                >
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
            </app-reserve-scenario-card>
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

  /** Les autres créneaux où le scénario est programmé : « créneau 1 », ou `''`. */
  protected scheduledRanks(scenario: ReserveScenarioDto): string {
    return formatReserveRanks(scenario, 'scheduled', this.timeSlots(), this.timeSlot().id);
  }
}
