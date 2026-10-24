import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import type { ReserveScenarioDto, ScheduleScenarioDto, TimeSlotDto } from '@chimeres/contract';
import { plural } from '../typography/french';
import { formatTimeSlotRanks } from '../typography/time';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { ScenarioIllustration } from '../ui/scenario-illustration';
import { TwoSlotBadge } from '../ui/two-slot-badge';
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
  imports: [Button, CdkDrag, CdkDropList, Icon, ScenarioIllustration, TwoSlotBadge],
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
          <app-scenario-illustration [title]="scenario.title" [imageUrl]="scenario.imageUrl" />
          <h3 [id]="'reserve-' + scenario.id">{{ scenario.title }}</h3>
          <p class="meta">{{ scenario.system }} · {{ scenario.gameMaster.nickname }}</p>
          @if (scenario.duration === 2) {
            <app-two-slot-badge />
          }
          <div class="foot">
            @if (selected() === ALL) {
              @if (scenario.unschedulable; as refusal) {
                <p class="reason">{{ refusal.detail }}</p>
              }
              @let scheduled = ranksWhere(scenario, 'scheduled');
              @let inReserve = ranksWhere(scenario, 'inReserve');
              @if (scheduled || inReserve) {
                <ul class="pastilles" aria-label="Créneaux">
                  @if (scheduled) {
                    <li class="pastille scheduled">
                      <app-icon name="circle-check" />
                      Programmé&nbsp;: {{ scheduled }}
                    </li>
                  }
                  @if (inReserve) {
                    <li class="pastille">
                      <app-icon name="inbox" />
                      En réserve&nbsp;: {{ inReserve }}
                    </li>
                  }
                </ul>
              }
            } @else if (ranksWhere(scenario, 'scheduled'); as ranks) {
              <p class="pastille scheduled">
                <app-icon name="circle-check" />
                Déjà programmé&nbsp;: {{ ranks }}
              </p>
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
          </div>
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

      /*
       * Vignette, titre et méta en tête ; le pied court sur toute la largeur de la carte. Le bouton
       * s'y cale à droite, et passe à la ligne plutôt que de recouvrir les pastilles.
       */
      /* Sa propre classe : l'aperçu du glisser, cloné hors de la liste, garde sa mise en page. */
      .scenario {
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

      app-scenario-illustration {
        grid-area: thumb;
        width: 44px;
      }

      h3 {
        grid-area: title;
        align-self: end;
      }

      .meta {
        grid-area: meta;
        align-self: start;
      }

      /* Le badge « double », en haut à droite, à côté du titre. */
      app-two-slot-badge {
        grid-area: badge;
        align-self: start;
      }

      h3,
      .meta {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
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

      /* Grisé : ni en réserve ni programmé nulle part. La raison, elle, reste lisible. */
      .unschedulable {
        app-scenario-illustration {
          opacity: 0.5;
          filter: grayscale(1);
        }

        h3 {
          color: var(--text-muted);
        }
      }

      .reason {
        flex-basis: 100%;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      /* Les pastilles s'enchaînent avec le bouton, dans le flux du pied : il les suit, sans les serrer. */
      .pastilles {
        display: contents;
      }

      /* Pastille (docs/design/patterns.md, Statuts) : icône et libellé. */
      .pastille {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
        white-space: nowrap;

        &.scheduled {
          color: var(--success);
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
  protected ranksWhere(
    { timeSlots }: ReserveScenarioDto,
    state: 'scheduled' | 'inReserve',
  ): string {
    return formatTimeSlotRanks(
      timeSlots.filter((slot) => slot[state]).map(({ timeSlotId }) => this.rankOf(timeSlotId)),
    );
  }

  protected end() {
    const drop = this.drag.end();
    if (drop) this.dropped.emit(drop);
  }

  private isInReserveOn({ timeSlots }: ReserveScenarioDto, timeSlotId: string): boolean {
    return timeSlots.some((slot) => slot.timeSlotId === timeSlotId && slot.inReserve);
  }

  private rankOf(timeSlotId: string): number {
    return this.timeSlots().find(({ id }) => id === timeSlotId)?.rank ?? 0;
  }
}
