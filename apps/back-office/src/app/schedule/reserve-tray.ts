import { Component, computed, input, linkedSignal, output } from '@angular/core';
import type { ReserveDto, ScheduleScenarioDto, TimeSlotDto } from '@chimeres/contract';
import { Button } from '../ui/button';
import { ScenarioIllustration } from '../ui/scenario-illustration';

/**
 * Le bac de réserve, sous la frise (docs/design/patterns.md, Bac de réserve) : filtré par créneau,
 * chaque filtre portant son nombre de scénarios. Chaque scénario offre « Programmer sur… ».
 */
@Component({
  selector: 'app-reserve-tray',
  imports: [Button, ScenarioIllustration],
  template: `
    <div class="filters" role="group" aria-label="Créneau de la réserve">
      @for (entry of reserve(); track entry.timeSlotId) {
        <button
          type="button"
          class="filter"
          [attr.aria-pressed]="entry.timeSlotId === selected()"
          (click)="selected.set(entry.timeSlotId)"
        >
          <span class="caps">Créneau {{ rankOf(entry.timeSlotId) }}</span>
          <!-- Un badge à part : « Créneau 2 » suivi de « 1 » ne doit pas se lire « Créneau 21 ». -->
          <span class="count"
            ><span class="visually-hidden">&#32;·&#32;</span>{{ entry.scenarioIds.length
            }}<span class="visually-hidden">&#32;{{ scenarioWord(entry) }}</span></span
          >
        </button>
      }
    </div>
    <ul>
      @for (scenario of shown(); track scenario.id) {
        <li>
          <app-scenario-illustration [title]="scenario.title" [imageUrl]="scenario.imageUrl" />
          <div class="text">
            <h3 [id]="'reserve-' + scenario.id">{{ scenario.title }}</h3>
            <p>{{ scenario.system }} · {{ scenario.gameMaster.nickname }}</p>
          </div>
          <button
            type="button"
            appButton="secondary"
            [attr.aria-describedby]="'reserve-' + scenario.id"
            (click)="scheduleOn.emit(scenario)"
          >
            Programmer sur…
          </button>
        </li>
      } @empty {
        <li class="none">Aucun scénario en réserve sur ce créneau.</li>
      }
    </ul>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);
      }

      .filter {
        display: inline-flex;
        gap: var(--space-s);
        align-items: center;
        padding: var(--space-xs) var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: none;
        color: var(--text-muted);
        cursor: pointer;

        &[aria-pressed='true'] {
          border-color: var(--accent);
          color: var(--text);
        }
      }

      .caps {
        font-family: var(--font-caps);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .count {
        min-width: 1.5rem;
        padding: 0 var(--space-xs);
        border-radius: 999px;
        background: var(--surface-3);
        color: var(--text);
        font-family: var(--font-ui);
        font-size: var(--font-size-meta);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }

      [aria-pressed='true'] .count {
        background: color-mix(in srgb, var(--accent) 14%, var(--surface-2));
      }

      ul {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: flex;
        gap: var(--space-s);
        align-items: center;
        width: 20rem;
        padding: var(--space-s);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-1);
      }

      li.none {
        width: auto;
        border: 0;
        background: none;
        color: var(--text-muted);
      }

      app-scenario-illustration {
        flex: none;
        width: 44px;
      }

      .text {
        flex: 1;
        min-width: 0;

        > * {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
      }

      h3 {
        font-family: var(--font-ui);
        font-size: var(--font-size-body);
        font-weight: 600;
      }

      p {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class ReserveTray {
  /** Dans l'ordre de la journée. */
  readonly timeSlots = input.required<readonly TimeSlotDto[]>();
  /** La réserve de chaque créneau, dans l'ordre de la journée. */
  readonly reserve = input.required<readonly ReserveDto[]>();
  /** Les scénarios de la réserve, dans l'ordre naturel de leur titre. */
  readonly scenarios = input.required<readonly ScheduleScenarioDto[]>();
  readonly scheduleOn = output<ScheduleScenarioDto>();

  /** Le créneau filtré : le premier, puis celui que l'Organisateur choisit, tant qu'il existe. */
  protected readonly selected = linkedSignal<readonly ReserveDto[], string | undefined>({
    source: () => this.reserve(),
    computation: (reserve, previous) =>
      reserve.some(({ timeSlotId }) => timeSlotId === previous?.value)
        ? previous!.value
        : reserve[0]?.timeSlotId,
  });

  protected readonly shown = computed(() => {
    const ids = this.reserve().find(({ timeSlotId }) => timeSlotId === this.selected());
    return this.scenarios().filter(({ id }) => ids?.scenarioIds.includes(id));
  });

  protected scenarioWord({ scenarioIds }: ReserveDto): string {
    return scenarioIds.length > 1 ? 'scénarios' : 'scénario';
  }

  protected rankOf(timeSlotId: string): number | undefined {
    return this.timeSlots().find(({ id }) => id === timeSlotId)?.rank;
  }
}
