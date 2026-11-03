import { Component, computed, input } from '@angular/core';
import type {
  AssignmentDto,
  DrawGameDto,
  DrawTrackingDto,
  TableDto,
  TimeSlotTrackingDto,
  TrackedGameDto,
} from '@chimeres/contract';
import { countOf, formatCount, formatSeats } from '@chimeres/design';
import { Gauge } from '../ui/gauge';
import { Icon } from '../ui/icon';
import { TwoSlotBadge } from '../ui/two-slot-badge';

/**
 * La pastille d'un joueur : crayon et pointillés s'il a été déplacé à la main, pseudo en jaune s'il
 * joue à une partie où il n'est pas inscrit. Le lecteur d'écran l'entend aussi.
 */
@Component({
  selector: 'li[appPlayerPill]',
  imports: [Icon],
  host: {
    '[class.moved]': 'player().movedByHand',
    '[class.unregistered]': 'player().playsWithoutSignUp',
  },
  template: `
    @if (player().movedByHand) {
      <app-icon name="pencil" />
    }
    <span class="nickname">{{ player().nickname }}</span>
    @if (player().movedByHand) {
      <span class="visually-hidden">, déplacé à la main</span>
    }
    @if (player().playsWithoutSignUp) {
      <span class="visually-hidden">, pas inscrit à cette partie</span>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: inline-flex;
        gap: var(--space-xxs);
        align-items: center;
        padding: 0 var(--space-s);
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface-3);
      }

      :host(.moved) {
        border-style: dashed;
      }

      :host(.unregistered) .nickname {
        color: var(--warning);
      }
    }
  `,
})
export class PlayerPill {
  readonly player = input.required<AssignmentDto>({ alias: 'appPlayerPill' });
}

/** Une carte du plan, après la carte « Non placés » : une partie du créneau, à sa table. */
type GameCard = { table: TableDto; game: TrackedGameDto; players: AssignmentDto[] } & (
  | { kind: 'drawn'; figures: DrawGameDto }
  /** Le second créneau d'une partie double : tirée avec son premier créneau, de rang `rank`. */
  | { kind: 'second-slot'; rank: number | undefined }
);

/**
 * Le plan de salle d'un créneau lancé (docs/design/patterns.md, Pilotage du jour J) : la carte
 * « Non placés » en tête, puis une carte par partie du créneau, dans l'ordre des tables. Les cartes
 * passent à la ligne, sans défilement horizontal. Il affiche les chiffres et les drapeaux reçus, sans
 * recalcul. En lecture seule pour l'instant.
 */
@Component({
  selector: 'app-draw-plan',
  imports: [Gauge, Icon, PlayerPill, TwoSlotBadge],
  template: `
    <ul class="plan" aria-label="Plan de salle">
      <li class="card unassigned">
        <h3>Non placés</h3>
        <p class="meta">
          {{ countOf(draw().unassignedCount, 'participant', 'participants') }} ·
          {{ countOf(draw().freeSeatCount, 'place libre', 'places libres') }} dans le créneau
        </p>
        <ul class="players">
          @for (player of unassigned(); track player.participantId) {
            <li [appPlayerPill]="player"></li>
          }
        </ul>
      </li>
      @for (card of cards(); track card.game.id) {
        <li class="card" [class.second-slot]="card.kind === 'second-slot'">
          <p class="table">{{ card.table.name }}</p>
          <h3>{{ card.game.scenario.title }}</h3>
          <p class="meta">
            {{ card.game.scenario.system }} · {{ card.game.scenario.gameMaster.nickname }}
          </p>
          @switch (card.kind) {
            @case ('drawn') {
              <app-gauge
                [count]="card.figures.playerCount"
                [min]="card.game.seats.min"
                [max]="card.game.seats.max"
                [shortfall]="card.figures.belowMinimum"
              />
              <p>
                {{ countOf(card.figures.playerCount, 'joueur', 'joueurs') }} ·
                {{ formatSeats(card.game.seats) }}
                @if (card.figures.surplusPlayerCount) {
                  ·
                  <strong class="warning"
                    >{{ formatCount(card.figures.surplusPlayerCount) }}&nbsp;de trop</strong
                  >
                } @else {
                  · {{ countOf(card.figures.freeSeatCount, 'place libre', 'places libres') }}
                }
              </p>
              <div class="badges">
                @if (card.game.timeSlotIds.length > 1) {
                  <app-two-slot-badge />
                }
                @if (card.figures.belowMinimum) {
                  <span class="badge warning"
                    ><app-icon name="triangle-alert" />Sous son minimum</span
                  >
                }
                @if (card.figures.overMaximum) {
                  <span class="badge warning"
                    ><app-icon name="triangle-alert" />Au-delà du maximum</span
                  >
                }
              </div>
            }
            @case ('second-slot') {
              <p class="meta">Partie double, tirée avec le créneau {{ card.rank }}</p>
            }
          }
          <ul class="players">
            @for (player of card.players; track player.participantId) {
              <li [appPlayerPill]="player"></li>
            }
          </ul>
        </li>
      }
    </ul>
  `,
  styles: `
    @layer components {
      /* Les cartes passent à la ligne, sans défilement horizontal. */
      .plan {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
        gap: var(--space-m);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .card {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);

        p,
        h3 {
          margin: 0;
        }

        h3 {
          font-family: var(--font-ui);
          font-size: var(--font-size-block);
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        app-gauge {
          align-self: stretch;
        }
      }

      .card.unassigned {
        border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
        background: color-mix(in srgb, var(--danger) 8%, var(--surface-2));
      }

      .card.second-slot {
        opacity: 0.6;
      }

      .table {
        font-weight: 600;
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      strong {
        font-weight: 600;
      }

      .warning {
        color: var(--warning);
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }

      .badge {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        padding: 0 var(--space-s);
        border-radius: 999px;
        font-size: var(--font-size-meta);
      }

      .badge.warning {
        background: color-mix(in srgb, var(--warning) 14%, transparent);
      }

      .players {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
        margin: var(--space-xs) 0 0;
        padding: 0;
        list-style: none;
      }
    }
  `,
})
export class DrawPlan {
  /** Un créneau lancé : son tirage n'est pas `null`. */
  readonly timeSlot = input.required<TimeSlotTrackingDto>();
  /** Dans l'ordre de la journée : ils donnent le tirage du premier créneau d'une partie double. */
  readonly timeSlots = input.required<readonly TimeSlotTrackingDto[]>();
  /** Dans l'ordre des tables. */
  readonly tables = input.required<readonly TableDto[]>();
  readonly games = input.required<readonly TrackedGameDto[]>();

  protected readonly countOf = countOf;
  protected readonly formatCount = formatCount;
  protected readonly formatSeats = formatSeats;

  protected readonly draw = computed(() => this.timeSlot().draw as DrawTrackingDto);

  /** Les non placés, dans l'ordre reçu : l'ordre naturel des pseudos. */
  protected readonly unassigned = computed(() =>
    this.draw().assignments.filter(({ gameId }) => gameId === null),
  );

  protected readonly cards = computed(() =>
    this.tables().flatMap((table): GameCard[] => {
      const slotId = this.timeSlot().id;
      const game = this.games().find(
        (candidate) => candidate.tableId === table.id && candidate.timeSlotIds.includes(slotId),
      );
      if (!game) return [];
      if (game.timeSlotIds[0] === slotId) {
        const figures = this.draw().games.find(({ gameId }) => gameId === game.id);
        if (!figures) return [];
        const players = this.draw().assignments.filter(({ gameId }) => gameId === game.id);
        return [{ table, game, players, kind: 'drawn', figures }];
      }
      const first = this.timeSlots().find(({ id }) => id === game.timeSlotIds[0]);
      const players = (first?.draw?.assignments ?? []).filter(({ gameId }) => gameId === game.id);
      return [{ table, game, players, kind: 'second-slot', rank: first?.rank }];
    }),
  );
}
