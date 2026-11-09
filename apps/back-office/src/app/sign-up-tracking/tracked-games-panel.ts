import { Component, computed, input, output } from '@angular/core';
import type { TableDto, TimeSlotTrackingDto, TrackedGameDto } from '@chimeres/contract';
import { countOf, formatCount } from '@chimeres/design';
import { Button } from '../ui/button';
import { GameSignUpFigures } from '../ui/game-sign-up-figures';
import { ScenarioIllustration } from '../ui/scenario-illustration';
import { GameBadges } from './game-badges';

/** Ce que montre la ligne d'une table sur le créneau. */
type TableRow = { table: TableDto } & (
  | { kind: 'game'; game: TrackedGameDto }
  /** Le second créneau d'une partie double : ses inscrits comptent sur son premier, de rang `rank`. */
  | { kind: 'second-slot'; rank: number | undefined }
  | { kind: 'free' }
);

/**
 * L'onglet « Parties du créneau » (docs/design/patterns.md, Pilotage du jour J) : le nombre de
 * tables libres, puis une ligne par table, dans l'ordre des tables. Une partie montre ses inscrits
 * face à ses places, avec leur écart (`app-game-sign-up-figures`). Un clic sur sa ligne ouvre sa fiche ; au clavier, son titre en est le bouton. Une
 * table libre offre « Programmer ici… ».
 */
@Component({
  selector: 'app-tracked-games-panel',
  imports: [Button, GameBadges, GameSignUpFigures, ScenarioIllustration],
  template: `
    <p class="free-tables">{{ countOf(freeTableCount(), 'table libre', 'tables libres') }}</p>
    <ul>
      @for (row of rows(); track row.table.id) {
        <li [class]="row.kind" (click)="openRow(row)">
          <span class="table" [id]="tableNameIdOf(row.table)">{{ row.table.name }}</span>
          @switch (row.kind) {
            @case ('game') {
              @let game = row.game;
              <app-scenario-illustration
                format="thumb"
                [title]="game.scenario.title"
                [imageUrl]="game.scenario.imageUrl"
              />
              <div class="identity">
                <button
                  type="button"
                  class="title"
                  [id]="rowIdOf(game.id)"
                  aria-controls="game-sheet"
                  [attr.aria-expanded]="game.id === openGameId()"
                >
                  {{ game.scenario.title }}
                </button>
                <span class="meta"
                  >{{ game.scenario.system }} · {{ game.scenario.gameMaster.nickname }}</span
                >
              </div>
              <div class="figures">
                <app-game-sign-up-figures [game]="game" />
                @if (game.withoutOtherSignUpCount) {
                  <span class="meta"
                    >dont {{ formatCount(game.withoutOtherSignUpCount) }} sans autre inscription sur
                    le créneau</span
                  >
                }
                <app-game-badges [game]="game" />
              </div>
            }
            @case ('second-slot') {
              <span class="meta">Partie double, comptée sur le créneau {{ row.rank }}</span>
            }
            @case ('free') {
              <span class="meta">Table libre</span>
              <button
                type="button"
                appButton="secondary"
                [attr.aria-describedby]="tableNameIdOf(row.table)"
                (click)="scheduleOn.emit(row.table)"
              >
                Programmer ici…
              </button>
            }
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
      }

      p {
        margin: 0;
        color: var(--text-muted);
      }

      ul {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: grid;
        grid-template-columns: 6rem 44px minmax(0, 1fr) 16rem;
        gap: var(--space-m);
        align-items: center;
        min-height: 44px;
        padding: var(--space-s) var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
      }

      /* Toute la ligne d'une partie ouvre sa fiche ; son titre en est le bouton, au clavier. */
      li.game {
        cursor: pointer;

        &:hover {
          background: var(--surface-3);
        }
      }

      li.free {
        border-style: dashed;
      }

      li.second-slot {
        opacity: 0.6;
      }

      li.second-slot .meta {
        grid-column: 2 / -1;
      }

      li.free .meta {
        grid-column: 2 / 4;
      }

      li.free button {
        justify-self: end;
      }

      .table {
        font-weight: 600;
      }

      .identity,
      .figures {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        align-items: flex-start;
        min-width: 0;
      }

      .figures app-game-sign-up-figures {
        align-self: stretch;
      }

      .title {
        padding: 0;
        border: 0;
        background: none;
        color: var(--text);
        font: inherit;
        font-weight: 600;
        text-align: left;
        overflow-wrap: anywhere;
        cursor: pointer;

        &:hover {
          text-decoration: underline;
        }
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class TrackedGamesPanel {
  readonly timeSlot = input.required<TimeSlotTrackingDto>();
  /** Dans l'ordre de la journée : ils donnent le rang du premier créneau d'une partie double. */
  readonly timeSlots = input.required<readonly TimeSlotTrackingDto[]>();
  /** Dans l'ordre des tables. */
  readonly tables = input.required<readonly TableDto[]>();
  readonly games = input.required<readonly TrackedGameDto[]>();
  /** La partie dont la fiche est ouverte, ou `null`. */
  readonly openGameId = input<string | null>(null);

  readonly opened = output<TrackedGameDto>();
  /** « Programmer ici… » sur une table libre du créneau. */
  readonly scheduleOn = output<TableDto>();

  protected readonly countOf = countOf;
  protected readonly formatCount = formatCount;
  protected readonly rowIdOf = rowIdOf;

  /** L'id du nom de la table, dans sa ligne : il décrit « Programmer ici… ». */
  protected tableNameIdOf(table: TableDto): string {
    return `tracked-table-${table.id}`;
  }

  /** Le clic du titre remonte jusqu'à la ligne : une seule ouverture. */
  protected openRow(row: TableRow) {
    if (row.kind === 'game') this.opened.emit(row.game);
  }

  protected readonly rows = computed(() =>
    this.tables().map((table): TableRow => {
      const slotId = this.timeSlot().id;
      const game = this.games().find(
        (candidate) => candidate.tableId === table.id && candidate.timeSlotIds.includes(slotId),
      );
      if (!game) return { table, kind: 'free' };
      if (game.timeSlotIds[0] === slotId) return { table, kind: 'game', game };
      const rank = this.timeSlots().find(({ id }) => id === game.timeSlotIds[0])?.rank;
      return { table, kind: 'second-slot', rank };
    }),
  );
  protected readonly freeTableCount = computed(
    () => this.rows().filter(({ kind }) => kind === 'free').length,
  );
}

/** L'id du titre de la partie, dans sa ligne : la page y rend le focus. */
export function rowIdOf(gameId: string): string {
  return `tracked-game-${gameId}`;
}
