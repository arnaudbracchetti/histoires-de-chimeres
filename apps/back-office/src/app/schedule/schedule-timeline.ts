import { Component, computed, input, output } from '@angular/core';
import type { GameDto, TableDto, TimeSlotDto } from '@chimeres/contract';
import { formatSeats } from '../scenarios/scenario-format';
import { formatDuration, formatTimeRange, minutesOf } from '../time-slots/time-format';
import { ScenarioIllustration } from '../ui/scenario-illustration';

/**
 * Largeur minimale d'une minute de créneau (docs/design/patterns.md, Frise). Au-delà, les créneaux
 * se partagent la largeur de l'écran au prorata de leur durée.
 */
const PX_PER_MINUTE = 0.8;

/**
 * Colonne des noms de table : la largeur du plus long, qui passe à la ligne au-delà de 10rem, pour
 * laisser la place aux créneaux. Colonne d'une pause : étroite, mais assez large pour sa durée.
 */
const TABLE_COLUMN = 'fit-content(10rem)';
const PAUSE_COLUMN = 'minmax(3rem, max-content)';

/** Une colonne de la frise : un créneau, ou la pause qui sépare deux créneaux. */
type Column =
  | { kind: 'slot'; slot: TimeSlotDto; minutes: number }
  | { kind: 'pause'; id: string; duration: string };

/**
 * La frise du programme : le temps court vers la droite, une colonne par créneau, de largeur
 * proportionnelle à sa durée, et une colonne étroite par pause, avec sa durée. Une ligne par table.
 * Chaque partie est une carte : un clic dessus ouvre sa fiche. La page focalise son bouton par son
 * id (`game-<id>`).
 */
@Component({
  selector: 'app-schedule-timeline',
  imports: [ScenarioIllustration],
  template: `
    <div class="scroller">
      <div
        class="grid"
        role="table"
        aria-label="Programme, par table et par créneau"
        [style.grid-template-columns]="gridColumns()"
      >
        <div class="row" role="row">
          <span role="cell"></span>
          @for (column of columns(); track trackOf(column)) {
            @if (column.kind === 'slot') {
              <div role="columnheader" class="slot">
                <span class="caps">Créneau {{ column.slot.rank }}</span
                >{{ ' ' }}
                <span class="range">{{ range(column.slot) }}</span>
              </div>
            } @else {
              <div role="columnheader" class="pause">
                <span class="visually-hidden">Pause de</span> {{ column.duration }}
              </div>
            }
          }
        </div>
        @for (table of tables(); track table.id) {
          <div class="row" role="row">
            <div role="rowheader" class="caps table-name">{{ table.name }}</div>
            @for (column of columns(); track trackOf(column)) {
              @if (column.kind === 'slot') {
                <div role="cell" class="cell">
                  @if (gameAt(column.slot.id, table.id); as game) {
                    <article class="game" [class.selected]="game.id === selectedGameId()">
                      <app-scenario-illustration
                        [title]="game.scenario.title"
                        [imageUrl]="game.scenario.imageUrl"
                      />
                      <div class="text">
                        <h3 class="title">
                          <button
                            type="button"
                            class="open"
                            [id]="'game-' + game.id"
                            [attr.aria-expanded]="game.id === selectedGameId()"
                            aria-controls="game-sheet"
                            (click)="opened.emit(game)"
                          >
                            {{ game.scenario.title }}
                          </button>
                        </h3>
                        <p>{{ game.scenario.system }}</p>
                        <p>{{ game.scenario.gameMaster.nickname }}</p>
                        <p>{{ formatSeats(game.seats) }}</p>
                      </div>
                    </article>
                  }
                </div>
              } @else {
                <div role="cell" class="pause"></div>
              }
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: block;
      }

      .scroller {
        overflow-x: auto;
      }

      /* Les colonnes viennent de gridColumns() : la grille prend toute la largeur. */
      .grid {
        display: grid;
        gap: var(--space-xs);
      }

      .row {
        display: contents;
      }

      .caps {
        font-family: var(--font-caps);
        font-weight: normal;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .table-name {
        align-self: center;
        overflow-wrap: anywhere;
      }

      .slot {
        padding-bottom: var(--space-xs);

        span {
          display: block;
        }
      }

      .range,
      .pause {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .pause {
        display: grid;
        place-items: center;
        padding-inline: var(--space-xs);
        background: var(--surface-1);
        border-radius: var(--radius-control);
      }

      .cell {
        min-width: 0;
        height: 4.5rem;
        border: 1px dashed var(--border);
        border-radius: var(--radius-control);
      }

      .game {
        position: relative;
        display: flex;
        gap: var(--space-xs);
        height: 100%;
        padding: var(--space-xs);
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-2);

        &:hover {
          background: var(--surface-3);
        }

        &.selected {
          border-color: var(--accent);
        }

        &:has(.open:focus-visible) {
          outline: 2px solid var(--focus);
          outline-offset: 2px;
        }
      }

      /* Le bouton du titre couvre toute la carte : un clic n'importe où l'ouvre. */
      .open {
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;

        &::after {
          content: '';
          position: absolute;
          inset: 0;
        }

        &:focus-visible {
          outline: none;
        }
      }

      app-scenario-illustration {
        flex: none;
        width: 32px;
      }

      .text {
        min-width: 0;
        font-size: var(--font-size-meta);
        color: var(--text-muted);

        > * {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
      }

      .title {
        font-family: var(--font-ui);
        font-size: var(--font-size-body);
        font-weight: 600;
        color: var(--text);
      }
    }
  `,
})
export class ScheduleTimeline {
  /** Dans l'ordre de la journée. */
  readonly timeSlots = input.required<readonly TimeSlotDto[]>();
  readonly tables = input.required<readonly TableDto[]>();
  readonly games = input.required<readonly GameDto[]>();
  /** La partie dont la fiche est ouverte. */
  readonly selectedGameId = input<string | null>(null);
  readonly opened = output<GameDto>();

  protected readonly formatSeats = formatSeats;

  protected readonly columns = computed<Column[]>(() =>
    this.timeSlots().flatMap((slot, index, slots) => {
      const column: Column = {
        kind: 'slot',
        slot,
        minutes: minutesOf(slot.end) - minutesOf(slot.start),
      };
      const next = slots[index + 1];
      if (!next || next.start === slot.end) return [column];
      return [
        column,
        { kind: 'pause', id: `pause-${slot.id}`, duration: formatDuration(slot.end, next.start) },
      ];
    }),
  );

  /** Chaque créneau : sa durée en `fr`, jamais sous 0,8 px par minute ; la frise défile au-delà. */
  protected readonly gridColumns = computed(() =>
    [
      TABLE_COLUMN,
      ...this.columns().map((column) =>
        column.kind === 'slot'
          ? `minmax(${column.minutes * PX_PER_MINUTE}px, ${column.minutes}fr)`
          : PAUSE_COLUMN,
      ),
    ].join(' '),
  );

  protected trackOf(column: Column): string {
    return column.kind === 'slot' ? column.slot.id : column.id;
  }

  protected range({ start, end }: TimeSlotDto): string {
    return formatTimeRange(start, end);
  }

  protected gameAt(timeSlotId: string, tableId: string): GameDto | undefined {
    return this.games().find(
      (game) => game.tableId === tableId && game.timeSlotIds.includes(timeSlotId),
    );
  }
}
