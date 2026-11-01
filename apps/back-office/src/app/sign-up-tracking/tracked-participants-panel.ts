import { Component, computed, input, model, output } from '@angular/core';
import type {
  ParticipantRiskDto,
  TableDto,
  TimeSlotTrackingDto,
  TrackedGameDto,
  TrackedParticipantDto,
} from '@chimeres/contract';
import { countOf, formatCount, formatShortSeatRange } from '@chimeres/design';
import { Icon } from '../ui/icon';
import { GameBadges } from './game-badges';
import { ParticipantRiskPill } from './participant-risk-pill';

/** Le filtre des pseudos : tous, ou ceux d'un risque. */
export type ParticipantFilter = 'all' | ParticipantRiskDto;

const FILTER_LABELS: Record<ParticipantFilter, string> = {
  all: 'Tous',
  'may-not-be-placed': 'Risquent de ne pas être placés',
  'may-be-left-without-table': 'Risquent de rester sans table',
};

/**
 * Le filtre gardé à la relecture du créneau, tant que sa puce existe ; sinon « Tous ». Une puce à 0
 * n'existe pas.
 */
export function keepParticipantFilter(
  participants: readonly TrackedParticipantDto[],
  previous: ParticipantFilter | undefined,
): ParticipantFilter {
  return previous && previous !== 'all' && participants.some(({ risk }) => risk === previous)
    ? previous
    : 'all';
}

/**
 * L'onglet « Inscrits du créneau » (docs/design/patterns.md, Pilotage du jour J) : les puces de
 * filtre, puis un tableau, un pseudo par ligne et une partie par colonne, dans l'ordre des tables.
 * Les pseudos gardent l'ordre de l'API : une seule inscription d'abord, puis les autres. Le titre
 * d'une colonne ouvre la fiche de sa partie.
 */
@Component({
  selector: 'app-tracked-participants-panel',
  imports: [GameBadges, Icon, ParticipantRiskPill],
  template: `
    @if (!timeSlot().participants.length) {
      <p class="quiet">Aucune inscription sur ce créneau pour l'instant.</p>
    } @else {
      <div class="filters" role="group" aria-label="Filtre des inscrits">
        @for (chip of chips(); track chip.filter) {
          <button
            type="button"
            [attr.aria-pressed]="chip.filter === filter()"
            (click)="filter.set(chip.filter)"
          >
            {{ chip.label }}
            <span class="count"
              ><span class="visually-hidden">&#32;·&#32;</span>{{ formatCount(chip.count) }}</span
            >
          </button>
        }
      </div>
      <div class="scroller">
        <table>
          <thead>
            <tr>
              <th scope="col">Pseudo</th>
              @for (game of columns(); track game.id) {
                <th scope="col" class="game">
                  <button
                    type="button"
                    class="title"
                    aria-controls="game-sheet"
                    [attr.aria-expanded]="game.id === openGameId()"
                    (click)="opened.emit(game)"
                  >
                    {{ game.scenario.title }}
                  </button>
                  <span class="meta"
                    >{{ countOf(game.signUpCount, 'inscrit', 'inscrits') }} ·
                    {{ formatShortSeatRange(game.seats) }}</span
                  >
                  <app-game-badges [game]="game" />
                </th>
              }
              <th scope="col">Avertissement</th>
            </tr>
          </thead>
          @for (group of groups(); track group.label) {
            <tbody>
              <tr class="group">
                <th scope="rowgroup" [attr.colspan]="columns().length + 2">
                  {{ group.label }} · {{ formatCount(group.participants.length) }}
                </th>
              </tr>
              @for (participant of group.participants; track participant.id) {
                <tr>
                  <th scope="row">{{ participant.nickname }}</th>
                  @for (game of columns(); track game.id) {
                    <td class="mark">
                      @if (participant.gameIds.includes(game.id)) {
                        <app-icon name="check" /><span class="visually-hidden">inscrit</span>
                      }
                    </td>
                  }
                  <td>
                    @if (participant.risk) {
                      <app-participant-risk-pill [risk]="participant.risk" />
                    }
                  </td>
                </tr>
              }
            </tbody>
          }
        </table>
      </div>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      .quiet {
        margin: 0;
        color: var(--text-muted);
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);

        button {
          display: inline-flex;
          gap: var(--space-s);
          align-items: center;
          padding: var(--space-xs) var(--space-m);
          border: 1px solid var(--border);
          border-radius: var(--radius-control);
          background: none;
          color: var(--text-muted);
          font: inherit;
          cursor: pointer;

          &[aria-pressed='true'] {
            border-color: var(--accent);
            color: var(--text);
          }
        }
      }

      .count {
        min-width: 1.5rem;
        padding: 0 var(--space-xs);
        border-radius: 999px;
        background: var(--surface-3);
        color: var(--text);
        font-size: var(--font-size-meta);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }

      [aria-pressed='true'] .count {
        background: color-mix(in srgb, var(--accent) 14%, var(--surface-2));
      }

      .scroller {
        overflow-x: auto;
      }

      table {
        border-collapse: collapse;
      }

      th,
      td {
        padding: var(--space-xs) var(--space-m);
        border-bottom: 1px solid var(--border);
        text-align: left;
        vertical-align: middle;
      }

      thead th {
        position: sticky;
        top: 0;
        background: var(--surface-2);
        color: var(--text-muted);
        font-weight: 400;
        vertical-align: bottom;
      }

      /* Une colonne par partie : centrée, bordée, une sur deux teintée pour la suivre de haut en bas. */
      th.game,
      td.mark {
        border-inline: 1px solid var(--border);
        text-align: center;
      }

      th.game:nth-child(even),
      td.mark:nth-child(even) {
        background: color-mix(in srgb, var(--surface-3) 50%, var(--surface-2));
      }

      th.game {
        min-width: 9rem;

        > * {
          display: flex;
          justify-content: center;
          margin-top: var(--space-xxs);
        }

        /* Un bouton ne s'étire pas seul sur la largeur de la case. */
        .title {
          width: 100%;
          text-align: center;
        }
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
        font-size: var(--font-size-meta);
        font-variant-numeric: tabular-nums;
      }

      tbody th[scope='row'] {
        font-weight: 600;
      }

      tr.group th {
        padding-top: var(--space-m);
        color: var(--text-muted);
        font-size: var(--font-size-meta);
        font-weight: 600;
      }

      .mark {
        color: var(--accent);

        app-icon {
          vertical-align: middle;
        }
      }
    }
  `,
})
export class TrackedParticipantsPanel {
  readonly timeSlot = input.required<TimeSlotTrackingDto>();
  /** Dans l'ordre des tables. */
  readonly tables = input.required<readonly TableDto[]>();
  readonly games = input.required<readonly TrackedGameDto[]>();
  /** La partie dont la fiche est ouverte, ou `null`. */
  readonly openGameId = input<string | null>(null);
  /** Gardé par la page : il survit à la relecture et au changement d'onglet. */
  readonly filter = model<ParticipantFilter>('all');

  readonly opened = output<TrackedGameDto>();

  protected readonly countOf = countOf;
  protected readonly formatCount = formatCount;
  protected readonly formatShortSeatRange = formatShortSeatRange;

  /** Les parties qui commencent sur le créneau, dans l'ordre des tables. */
  protected readonly columns = computed(() =>
    this.tables().flatMap(({ id }) =>
      this.games().filter(
        (game) => game.tableId === id && game.timeSlotIds[0] === this.timeSlot().id,
      ),
    ),
  );

  /** « Tous », puis une puce par risque, sans celles à 0. */
  protected readonly chips = computed(() => {
    const participants = this.timeSlot().participants;
    return (['all', 'may-not-be-placed', 'may-be-left-without-table'] as const)
      .map((filter) => ({
        filter,
        label: FILTER_LABELS[filter],
        count:
          filter === 'all'
            ? participants.length
            : participants.filter(({ risk }) => risk === filter).length,
      }))
      .filter(({ count }) => count > 0);
  });

  /** Les deux groupes, dans l'ordre reçu, sans les pseudos filtrés ; un groupe vide n'apparaît pas. */
  protected readonly groups = computed(() => {
    const filter = this.filter();
    const shown = this.timeSlot().participants.filter(
      ({ risk }) => filter === 'all' || risk === filter,
    );
    return [
      {
        label: 'Une seule inscription',
        participants: shown.filter(({ gameIds }) => gameIds.length === 1),
      },
      {
        label: 'Plusieurs inscriptions',
        participants: shown.filter(({ gameIds }) => gameIds.length > 1),
      },
    ].filter(({ participants }) => participants.length);
  });
}
