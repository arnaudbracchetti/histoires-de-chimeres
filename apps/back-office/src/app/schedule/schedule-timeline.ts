import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, output } from '@angular/core';
import type { GameDto, TableDto, TimeSlotDto } from '@chimeres/contract';
import { formatSeats } from '../scenarios/scenario-format';
import { minutesOf } from '../time-slots/time-format';
import { formatDuration, formatTimeRange } from '../typography/time';
import { ScenarioIllustration } from '../ui/scenario-illustration';
import { TwoSlotBadge } from '../ui/two-slot-badge';
import { ScheduleDrag, type Drop, type DropTarget } from './schedule-drag';

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
 * Une case d'une ligne : celle d'un créneau, avec sa partie, qui couvre `span` colonnes (une partie
 * double couvre ses deux créneaux et la pause entre eux), ou celle d'une pause.
 */
type Cell =
  | { kind: 'slot'; id: string; game: GameDto | undefined; span: number }
  | { kind: 'pause'; id: string };

/**
 * La frise du programme : le temps court vers la droite, une colonne par créneau, de largeur
 * proportionnelle à sa durée, et une colonne étroite par pause, avec sa durée. Une ligne par table.
 * Chaque partie est une carte : un clic dessus ouvre sa fiche. La page focalise son bouton par son
 * id (`game-<id>`). Une partie double est une seule carte, étendue sur ses deux créneaux, par-dessus
 * la pause qui les sépare, avec le badge « double ». Une partie se glisse vers une case, une autre
 * partie ou le bac de réserve (`ScheduleDrag`) ; chaque case est une cible du geste.
 */
@Component({
  selector: 'app-schedule-timeline',
  host: { '[class.dragging]': '!!drag.subject()' },
  imports: [CdkDrag, CdkDropList, ScenarioIllustration, TwoSlotBadge],
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
        @for (row of rows(); track row.table.id) {
          <div class="row" role="row">
            <div role="rowheader" class="caps table-name">{{ row.table.name }}</div>
            @for (cell of row.cells; track cell.id) {
              @if (cell.kind === 'slot') {
                @let state = drag.stateOf(targetOf(row.table.id, cell));
                <div
                  role="cell"
                  class="cell"
                  cdkDropList
                  cdkDropListSortingDisabled
                  [class.valid]="state.kind === 'valid'"
                  [style.grid-column]="'span ' + cell.span"
                  [attr.aria-colspan]="cell.span > 1 ? cell.span : null"
                  [attr.data-drop-time-slot]="cell.id"
                  [attr.data-drop-table]="row.table.id"
                  [attr.data-drop-game]="cell.game?.id ?? ''"
                >
                  <!-- Une liste d'un élément : la carte se recrée quand une autre partie prend la case. -->
                  @for (game of cell.game ? [cell.game] : []; track game.id) {
                    <article
                      class="game"
                      cdkDrag
                      [cdkDragStartDelay]="{ touch: 300, mouse: 0 }"
                      [class.selected]="game.id === selectedGameId()"
                      [class.pending]="pendingGameIds().includes(game.id)"
                      (cdkDragStarted)="drag.start({ kind: 'game', game })"
                      [cdkDragConstrainPosition]="drag.byThumbnail"
                      (cdkDragMoved)="drag.move($event)"
                      (cdkDragReleased)="drag.release()"
                      (cdkDragEnded)="end()"
                    >
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
                      @if (game.timeSlotIds.length > 1) {
                        <app-two-slot-badge />
                      }
                    </article>
                  }
                  @if (state.kind === 'refused') {
                    <span class="reason">{{ state.refusal.title }}</span>
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
        position: relative;
        min-width: 0;
        height: 4.5rem;
        border: 1px dashed var(--border);
        border-radius: var(--radius-control);
        transition: box-shadow 150ms;

        /* Une cible valide du geste s'éclaire ; une cible refusée reste éteinte, avec son motif. */
        &.valid {
          box-shadow: var(--halo);
        }
      }

      .reason {
        position: absolute;
        inset: auto var(--space-xxs) var(--space-xxs) auto;
        padding: 0 var(--space-xs);
        border-radius: var(--radius-control);
        background: var(--surface-1);
        color: var(--text-muted);
        font-size: var(--font-size-meta);
        white-space: nowrap;
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
        transition: opacity 150ms;

        /* Pendant l'écriture d'un geste, à sa nouvelle place. */
        &.pending {
          opacity: 0.45;
        }

        /* L'élément saisi, sous le pointeur. Sa place d'origine reste en filigrane. */
        &.cdk-drag-preview {
          box-shadow: var(--halo);
        }

        &.cdk-drag-placeholder {
          opacity: 0.3;
        }

        /* Lâchée hors d'une cible valide, la carte revient à sa place. */
        &.cdk-drag-animating:not(.landing) {
          transition: transform 150ms ease-out;
        }

        &.selected {
          border-color: var(--accent);
        }

        &:has(.open:focus-visible) {
          outline: 2px solid var(--focus);
          outline-offset: 2px;
        }
      }

      /* Hors geste seulement : pendant un glisser, seul le halo des cibles valides parle. */
      :host(:not(.dragging)) .game:hover {
        background: var(--surface-3);
        box-shadow: var(--halo-soft);
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

      /* Le badge « double », calé en haut à droite de la carte. */
      app-two-slot-badge {
        align-self: flex-start;
        margin-left: auto;
      }

      .title {
        font-family: var(--font-ui);
        font-size: var(--font-size-body);
        font-weight: 600;
        color: var(--text);
      }

      @media (prefers-reduced-motion: reduce) {
        .cell,
        .game,
        .game.cdk-drag-animating:not(.landing) {
          transition: none;
        }
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
  /** Les parties dont un geste s'écrit encore : atténuées. */
  readonly pendingGameIds = input<readonly string[]>([]);
  readonly opened = output<GameDto>();
  readonly dropped = output<Drop>();

  protected readonly drag = inject(ScheduleDrag);

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

  /** Une ligne par table, avec ses cases : la carte d'une partie double couvre les colonnes suivantes. */
  protected readonly rows = computed(() =>
    this.tables().map((table) => ({ table, cells: this.cellsOf(table.id) })),
  );

  protected targetOf(tableId: string, cell: { id: string; game: GameDto | undefined }): DropTarget {
    return { kind: 'cell', timeSlotId: cell.id, tableId, gameId: cell.game?.id ?? null };
  }

  protected end() {
    const drop = this.drag.end();
    if (drop) this.dropped.emit(drop);
  }

  protected trackOf(column: Column): string {
    return column.kind === 'slot' ? column.slot.id : column.id;
  }

  protected range({ start, end }: TimeSlotDto): string {
    return formatTimeRange(start, end);
  }

  private cellsOf(tableId: string): Cell[] {
    const columns = this.columns();
    const cells: Cell[] = [];
    for (let index = 0; index < columns.length; index++) {
      const column = columns[index]!;
      if (column.kind === 'pause') {
        cells.push(column);
        continue;
      }
      const game = this.gameAt(column.slot.id, tableId);
      const lastSlotId = game?.timeSlotIds.at(-1) ?? column.slot.id;
      const last = columns.findIndex(
        (other) => other.kind === 'slot' && other.slot.id === lastSlotId,
      );
      cells.push({ kind: 'slot', id: column.slot.id, game, span: last - index + 1 });
      index = last;
    }
    return cells;
  }

  private gameAt(timeSlotId: string, tableId: string): GameDto | undefined {
    return this.games().find(
      (game) => game.tableId === tableId && game.timeSlotIds.includes(timeSlotId),
    );
  }
}
