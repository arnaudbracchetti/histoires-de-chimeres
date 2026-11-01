import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import type { ReserveScenarioDto, ScheduleScenarioDto, TimeSlotDto } from '@chimeres/contract';
import { plural } from '@chimeres/design';
import { Button } from '../ui/button';
import { ReservePastille } from '../ui/reserve-pastille';
import { formatReserveRanks, ReserveScenarioCard } from '../ui/reserve-scenario-card';
import { ScheduleDrag, type Drop } from './schedule-drag';

/** Le filtre « Tous les scénarios » ; les autres sont des identifiants de créneau. */
const ALL = 'all';

/**
 * Le bac de réserve, sous la frise (docs/design/patterns.md, Bac de réserve) : filtré par créneau,
 * chaque filtre portant son nombre de scénarios, ou sur « Tous les scénarios », avec une pastille
 * par statut. Un scénario double porte le badge « double ». Un scénario sans créneau possible y est
 * grisé, avec sa raison. Chaque autre scénario offre « Programmer sur… », et se glisse vers une case
 * de la frise. Le bac est aussi la cible d'une partie qu'on déprogramme (`ScheduleDrag`).
 */
@Component({
  selector: 'app-reserve-tray',
  imports: [Button, CdkDrag, CdkDropList, ReservePastille, ReserveScenarioCard],
  host: {
    'data-drop-reserve': '',
    '[class.valid]': 'drag.reserveIsValid()',
    '[class.dragging]': '!!drag.subject()',
  },
  template: `
    <div class="filters" role="group" aria-label="Filtre de la réserve">
      @for (filter of filters(); track filter.id) {
        <button
          type="button"
          class="filter"
          [attr.aria-pressed]="filter.id === selected()"
          (click)="selected.set(filter.id)"
        >
          <span class="caps">{{ filter.label }}</span>
          <!-- Un badge à part : « Créneau 2 » suivi de « 1 » ne doit pas se lire « Créneau 21 ». -->
          <span class="count"
            ><span class="visually-hidden">&#32;·&#32;</span>{{ filter.count
            }}<span class="visually-hidden"
              >&#32;{{ plural(filter.count, 'scénario', 'scénarios') }}</span
            ></span
          >
        </button>
      }
    </div>
    <ul class="scenarios" cdkDropList cdkDropListSortingDisabled>
      @for (scenario of shown(); track scenario.id) {
        <li
          class="scenario"
          cdkDrag
          [cdkDragDisabled]="!!scenario.unschedulable"
          [cdkDragStartDelay]="{ touch: 300, mouse: 0 }"
          [class.unschedulable]="scenario.unschedulable"
          (cdkDragStarted)="drag.start({ kind: 'scenario', scenario })"
          [cdkDragConstrainPosition]="drag.byThumbnail"
          (cdkDragMoved)="drag.move($event)"
          (cdkDragReleased)="drag.release()"
          (cdkDragEnded)="end()"
        >
          <app-reserve-scenario-card
            [scenario]="scenario"
            [refusal]="scenario.unschedulable"
            [titleId]="'reserve-' + scenario.id"
          >
            @if (selected() === ALL) {
              @let scheduled = ranksWhere(scenario, 'scheduled');
              @let inReserve = ranksWhere(scenario, 'inReserve');
              @if (scheduled || inReserve) {
                <ul class="pastilles" aria-label="Créneaux">
                  @if (scheduled) {
                    <li>
                      <app-reserve-pastille scheduled
                        >Programmé&nbsp;: {{ scheduled }}</app-reserve-pastille
                      >
                    </li>
                  }
                  @if (inReserve) {
                    <li>
                      <app-reserve-pastille>En réserve&nbsp;: {{ inReserve }}</app-reserve-pastille>
                    </li>
                  }
                </ul>
              }
            } @else if (ranksWhere(scenario, 'scheduled'); as ranks) {
              <app-reserve-pastille scheduled
                >Déjà programmé&nbsp;: {{ ranks }}</app-reserve-pastille
              >
            }
            @if (!scenario.unschedulable) {
              <button
                type="button"
                appButton="secondary"
                [attr.aria-describedby]="'reserve-' + scenario.id"
                (click)="scheduleOn.emit(scenario)"
              >
                Programmer sur…
              </button>
            }
          </app-reserve-scenario-card>
        </li>
      } @empty {
        <li class="none">
          @if (selected() === ALL) {
            Aucun scénario à programmer pour l'instant.
          } @else {
            Aucun scénario en réserve sur ce créneau.
          }
        </li>
      }
    </ul>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        border-radius: var(--radius-control);
        transition: box-shadow 150ms;
      }

      /* Pendant le geste d'une partie, le bac s'éclaire : on l'y dépose pour la déprogrammer. */
      :host(.valid) {
        box-shadow: var(--halo);
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

      /* Trois cartes dans la largeur de la frise, chacune à sa hauteur. */
      .scenarios {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        align-items: start;
      }

      /* Sa propre classe : l'aperçu du glisser, cloné hors de la liste, garde sa mise en page. */
      .scenario {
        border-radius: var(--radius-control);
        transition: box-shadow 150ms;

        /* Une carte qu'on peut saisir : la main ouverte. */
        &:not(.unschedulable) {
          cursor: grab;
        }

        /* Le scénario saisi, sous le pointeur ; sa carte reste en filigrane dans le bac. */
        &.cdk-drag-preview {
          box-shadow: var(--halo);
        }

        &.cdk-drag-placeholder {
          opacity: 0.3;
        }

        /* Lâché hors d'une cible valide, il revient à sa place. */
        &.cdk-drag-animating:not(.landing) {
          transition: transform 150ms ease-out;
        }
      }

      /* Le halo discret au survol, hors geste seulement : pendant un glisser, seul le halo des cibles
         valides parle. */
      :host(:not(.dragging)) .scenario:not(.unschedulable):hover {
        box-shadow: var(--halo-soft);
      }

      @media (prefers-reduced-motion: reduce) {
        :host,
        .scenario,
        .scenario.cdk-drag-animating:not(.landing) {
          transition: none;
        }
      }

      .none {
        grid-column: 1 / -1;
        color: var(--text-muted);
      }

      /* Les pastilles s'enchaînent avec le bouton, dans le flux du pied : il les suit, sans les serrer. */
      .pastilles {
        display: contents;
      }
    }
  `,
})
export class ReserveTray {
  /** Dans l'ordre de la journée. */
  readonly timeSlots = input.required<readonly TimeSlotDto[]>();
  /** Les scénarios, dans l'ordre naturel de leur titre, avec leur place sur chaque créneau. */
  readonly reserve = input.required<readonly ReserveScenarioDto[]>();
  readonly scheduleOn = output<ScheduleScenarioDto>();
  readonly dropped = output<Drop>();

  protected readonly drag = inject(ScheduleDrag);

  protected readonly ALL = ALL;
  protected readonly plural = plural;

  /** Un filtre par créneau, dans l'ordre de la journée, puis « Tous les scénarios ». */
  protected readonly filters = computed(() => [
    ...this.timeSlots().map(({ id, rank }) => ({
      id,
      label: `Créneau ${rank}`,
      count: this.reserve().filter((scenario) => this.isInReserveOn(scenario, id)).length,
    })),
    { id: ALL, label: 'Tous les scénarios', count: this.reserve().length },
  ]);

  /** Le filtre choisi : le premier créneau, puis celui que l'Organisateur choisit, tant qu'il existe. */
  protected readonly selected = linkedSignal<readonly TimeSlotDto[], string | undefined>({
    source: () => this.timeSlots(),
    computation: (timeSlots, previous) =>
      previous?.value === ALL || timeSlots.some(({ id }) => id === previous?.value)
        ? previous!.value
        : (timeSlots[0]?.id ?? ALL),
  });

  protected readonly shown = computed(() => {
    const selected = this.selected();
    return selected === ALL
      ? this.reserve()
      : this.reserve().filter((scenario) => this.isInReserveOn(scenario, selected!));
  });

  /**
   * « créneau 1 », « créneaux 2, 3 et 4 » : les créneaux où le scénario est programmé, ou en
   * réserve. `''` s'il n'y en a aucun.
   */
  protected ranksWhere(scenario: ReserveScenarioDto, state: 'scheduled' | 'inReserve'): string {
    return formatReserveRanks(scenario, state, this.timeSlots());
  }

  protected end() {
    const drop = this.drag.end();
    if (drop) this.dropped.emit(drop);
  }

  private isInReserveOn({ timeSlots }: ReserveScenarioDto, timeSlotId: string): boolean {
    return timeSlots.some((slot) => slot.timeSlotId === timeSlotId && slot.inReserve);
  }
}
