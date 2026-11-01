import { Component, computed, input, output } from '@angular/core';
import type { TableDto, TimeSlotTrackingDto, TrackedGameDto } from '@chimeres/contract';
import { countOf, formatCount, formatSeats } from '@chimeres/design';
import { Gauge } from '../ui/gauge';
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
 * face à ses places, avec leur écart (« 11 de trop », « 1 manquant »), d'après les chiffres et les
 * drapeaux reçus. Un clic sur sa ligne ouvre sa fiche ; au clavier, son titre en est le bouton.
 */
@Component({
  selector: 'app-tracked-games-panel',
  imports: [GameBadges, Gauge, ScenarioIllustration],
  template: `
    <p class="free-tables">{{ countOf(freeTableCount(), 'table libre', 'tables libres') }}</p>
    <ul>
      @for (row of rows(); track row.table.id) {
        <li [class]="row.kind" (click)="openRow(row)">
          <span class="table">{{ row.table.name }}</span>
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
                <app-gauge
                  [count]="game.signUpCount"
                  [min]="game.seats.min"
                  [max]="game.seats.max"
                  [shortfall]="game.belowMinimum"
                />
                <span
                  >{{ countOf(game.signUpCount, 'inscrit', 'inscrits') }} ·
                  {{ formatSeats(game.seats) }}
                  @if (game.surplusSignUpCount) {
                    · <strong>{{ formatCount(game.surplusSignUpCount) }}&nbsp;de trop</strong>
                  }
                  @if (game.missingSignUpCount) {
                    ·
                    <strong class="missing">{{
                      countOf(game.missingSignUpCount, 'manquant', 'manquants')
                    }}</strong>
                  }
                </span>
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

      li:not(.game) .meta {
        grid-column: 2 / -1;
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

      .figures app-gauge {
        align-self: stretch;
        margin-bottom: var(--space-xxs);
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

      strong {
        font-weight: 600;
      }

      .missing {
        color: var(--warning);
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

  protected readonly countOf = countOf;
  protected readonly formatCount = formatCount;
  protected readonly formatSeats = formatSeats;
  protected readonly rowIdOf = rowIdOf;

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
