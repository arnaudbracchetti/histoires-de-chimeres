import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  signUpTrackingEndpoints,
  type TimeSlotStateDto,
  type TimeSlotTrackingDto,
} from '@chimeres/contract';
import {
  formatCount,
  formatSeatRange,
  formatTimeRange,
  fr,
  plural,
  timeSlotLabel,
} from '@chimeres/design';
import { apiResource, currentValue } from '../api-resource';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Gauge } from '../ui/gauge';
import { Icon } from '../ui/icon';

/** L'état d'un créneau fermé, sur sa tuile : les termes du front office. */
const CLOSED_STATE: Record<Exclude<TimeSlotStateDto, 'sign-ups-open'>, string> = {
  drawing: 'Tirage en cours',
  published: 'Tirage publié',
};

/** Ce que dit le résumé d'un créneau fermé. */
const CLOSED_SUMMARY: Record<Exclude<TimeSlotStateDto, 'sign-ups-open'>, string> = {
  drawing: fr`Tirage en cours : les inscriptions sont fermées.`,
  published: fr`Tirage publié : les inscriptions sont fermées et le programme du créneau ne change plus.`,
};

/**
 * Pilotage du jour J (docs/design/patterns.md) : la bande des créneaux de la journée, avec la
 * demande et la capacité de chacun, puis le résumé du créneau choisi. La page affiche ce que l'API
 * calcule, sans recalcul.
 */
@Component({
  selector: 'app-sign-up-tracking-page',
  imports: [Button, EmptyState, Gauge, Icon, Loadable, PageHeader, RouterLink],
  template: `
    <app-page-header title="Pilotage du jour J">
      <p appPageSubtitle class="freshness"></p>
    </app-page-header>
    <app-loadable [resource]="tracking" failure="Impossible de charger le suivi des inscriptions.">
      @if (value(); as tracking) {
        @if (!tracking.timeSlots.length) {
          <app-empty-state>
            <p>Aucun créneau pour l'instant&nbsp;: le suivi attend la journée.</p>
            <a appButton="primary" routerLink="/creneaux-et-tables">Créer les créneaux</a>
          </app-empty-state>
        } @else {
          <div class="strip" role="group" aria-label="Créneaux de la journée">
            @for (slot of tracking.timeSlots; track slot.id) {
              <button
                type="button"
                class="tile"
                [class.closed]="slot.state !== 'sign-ups-open'"
                [attr.aria-pressed]="slot.id === selected()?.id"
                (click)="selectedId.set(slot.id)"
              >
                <span class="rank">Créneau {{ slot.rank }}</span>
                <span class="range">{{ range(slot) }}</span>
                @if (slot.state === 'sign-ups-open') {
                  <span class="ratio"
                    >{{ formatCount(slot.demand) }}&nbsp;/&nbsp;{{
                      formatCount(slot.capacity.max)
                    }}</span
                  >
                  <span class="legend">participants / places</span>
                  <app-gauge
                    [count]="slot.demand"
                    [min]="slot.capacity.min"
                    [max]="slot.capacity.max"
                    overflow="danger"
                  />
                } @else {
                  <span class="state"><app-icon name="lock" />{{ closedState[slot.state] }}</span>
                }
              </button>
            }
          </div>
          @if (selected(); as slot) {
            <section class="summary" aria-labelledby="summary-title">
              <h2 id="summary-title">{{ timeSlotLabel(slot) }}</h2>
              @if (slot.state === 'sign-ups-open') {
                <p class="figures">
                  <span
                    ><span class="figure">{{ formatCount(slot.demand) }}</span
                    >&nbsp;{{ participants(slot.demand) }}</span
                  >
                  <span
                    ><span class="figure">{{ formatSeatRange(slot.capacity) }}</span
                    >&nbsp;{{ places(slot.capacity.max) }}</span
                  >
                </p>
                <app-gauge
                  class="wide"
                  [count]="slot.demand"
                  [min]="slot.capacity.min"
                  [max]="slot.capacity.max"
                  overflow="danger"
                />
                @if (!slot.demand) {
                  <p class="quiet">Aucune inscription sur ce créneau pour l'instant.</p>
                }
              } @else {
                <p class="quiet">{{ closedSummary[slot.state] }}</p>
              }
            </section>
          }
        }
      }
    </app-loadable>
  `,
  styles: `
    @layer components {
      .freshness {
        min-height: calc(var(--font-size-meta) * var(--line-height-text));
        margin: var(--space-xs) 0 0;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      :host > app-loadable {
        display: flex;
        flex-direction: column;
        gap: var(--space-l);
        padding: var(--space-l) var(--space-xl);
      }

      .strip {
        display: flex;
        gap: var(--space-s);
        overflow-x: auto;
      }

      .tile {
        display: flex;
        flex: 1 0 10rem;
        flex-direction: column;
        gap: var(--space-xxs);
        align-items: flex-start;
        padding: var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);
        color: var(--text);
        font: inherit;
        text-align: left;
        cursor: pointer;

        &:hover {
          background: var(--surface-3);
        }

        &[aria-pressed='true'] {
          border-color: var(--accent);
          box-shadow: var(--halo);
        }

        app-gauge {
          align-self: stretch;
          margin-top: var(--space-xs);
        }
      }

      .tile.closed {
        opacity: 0.45;
      }

      .rank {
        font-weight: 600;
      }

      .range,
      .legend {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .ratio,
      .figure {
        font-family: var(--font-ui);
        font-size: var(--font-size-title);
        font-variant-numeric: tabular-nums;
        line-height: var(--line-height-title);
      }

      .state {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        margin-top: var(--space-xs);
        color: var(--text-muted);
      }

      .summary {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        padding: var(--space-l);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);

        h2 {
          margin: 0;
          font-size: var(--font-size-section);
        }

        p {
          margin: 0;
        }
      }

      .figures {
        display: flex;
        gap: var(--space-xl);
        align-items: baseline;
      }

      app-gauge.wide {
        height: var(--space-m);
      }

      .quiet {
        color: var(--text-muted);
      }
    }
  `,
})
export class SignUpTrackingPage {
  protected readonly tracking = apiResource(signUpTrackingEndpoints.read);
  protected readonly value = currentValue(this.tracking);
  protected readonly closedState = CLOSED_STATE;
  protected readonly closedSummary = CLOSED_SUMMARY;
  protected readonly formatCount = formatCount;
  protected readonly formatSeatRange = formatSeatRange;
  protected readonly timeSlotLabel = timeSlotLabel;

  /** Le créneau choisi d'un clic ; avant, le premier dont les inscriptions sont ouvertes. */
  protected readonly selectedId = signal<string | undefined>(undefined);
  protected readonly selected = computed(() => {
    const timeSlots = this.value()?.timeSlots ?? [];
    return (
      timeSlots.find(({ id }) => id === this.selectedId()) ??
      timeSlots.find(({ state }) => state === 'sign-ups-open') ??
      timeSlots[0]
    );
  });

  protected range({ start, end }: TimeSlotTrackingDto): string {
    return formatTimeRange(start, end);
  }

  protected participants(demand: number): string {
    return plural(demand, 'participant', 'participants');
  }

  /** Le nom accordé à la capacité maximum : « 14 à 22 places », « 1 place ». */
  protected places(max: number): string {
    return plural(max, 'place', 'places');
  }
}
