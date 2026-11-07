import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, linkedSignal, output } from '@angular/core';
import type {
  AssignmentDto,
  DrawGameDto,
  DrawTrackingDto,
  TableDto,
  TimeSlotTrackingDto,
  TrackedGameDto,
} from '@chimeres/contract';
import { countOf, formatCount, formatSeats, fr } from '@chimeres/design';
import { Button } from '../ui/button';
import { Gauge } from '../ui/gauge';
import { Icon } from '../ui/icon';
import { TwoSlotBadge } from '../ui/two-slot-badge';

/**
 * La pastille d'un joueur : crayon et pointillés s'il a été déplacé à la main, pseudo en jaune s'il
 * joue à une partie où il n'est pas inscrit. Le lecteur d'écran l'entend aussi. Sur un tirage
 * provisoire, elle est un bouton qui choisit le joueur (`aria-pressed`, bordure orange).
 */
@Component({
  selector: 'li[appPlayerPill]',
  imports: [Icon, NgTemplateOutlet],
  host: {
    '[class.moved]': 'player().movedByHand',
    '[class.unregistered]': 'player().playsWithoutSignUp',
    '[class.chosen]': 'chosen()',
  },
  template: `
    <ng-template #content>
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
    </ng-template>
    @if (choosable()) {
      <button type="button" [attr.aria-pressed]="chosen()" (click)="choose.emit()">
        <ng-container *ngTemplateOutlet="content" />
      </button>
    } @else {
      <ng-container *ngTemplateOutlet="content" />
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

      /* Un anneau hors de la bordure : la pastille garde ses pointillés et ne grandit pas. */
      :host(.chosen) {
        box-shadow: 0 0 0 2px var(--accent);
      }

      button {
        display: inline-flex;
        gap: var(--space-xxs);
        align-items: center;
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
    }
  `,
})
export class PlayerPill {
  readonly player = input.required<AssignmentDto>({ alias: 'appPlayerPill' });
  /** Sur un tirage provisoire : un clic choisit le joueur. */
  readonly choosable = input(false);
  readonly chosen = input(false);
  readonly choose = output<void>();
}

/**
 * Un déplacement : le joueur choisi, et sa nouvelle partie, à sa table, ou `null` pour le retirer
 * de sa table.
 */
export type ParticipantMove = {
  participant: AssignmentDto;
  target: { game: TrackedGameDto; table: TableDto } | null;
};

/** Une partie du créneau et son tirage : ce qu'annuler et rétablir reçoivent. */
export type DrawnGame = { game: TrackedGameDto; figures: DrawGameDto };

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
 * recalcul. Sur un tirage provisoire, une partie qui a moins de joueurs que son minimum offre
 * « Annuler la partie », et une partie annulée « Rétablir la partie » : la page fait le geste.
 *
 * On y déplace un participant en deux clics : le joueur, puis sa nouvelle table, ou « Retirer de sa
 * table » sur la carte « Non placés ». Le choix survit à une relecture tant que le joueur reste
 * dans le tirage ; « Annuler » et Échap le défont.
 */
@Component({
  selector: 'app-draw-plan',
  imports: [Button, Gauge, Icon, PlayerPill, TwoSlotBadge],
  host: { '(keydown.escape)': 'dropChoice()' },
  template: `
    @if (!draw().published) {
      <div class="banner">
        @if (chosen()) {
          <p>{{ chosenSummary() }}</p>
          <button type="button" appButton="quiet" (click)="dropChoice()">Annuler</button>
        } @else {
          <p>Choisis un joueur, puis sa nouvelle table.</p>
          <p class="legend">
            <span><app-icon name="pencil" />déplacé à la main</span>
            <span><span class="warning">Pseudo</span> en jaune&nbsp;: joue sans inscription</span>
          </p>
        }
      </div>
    }
    <ul class="plan" aria-label="Plan de salle">
      <li class="card unassigned">
        <h3>Non placés</h3>
        <p class="meta">
          {{ countOf(draw().unassignedCount, 'participant', 'participants') }} ·
          {{ countOf(draw().freeSeatCount, 'place libre', 'places libres') }} dans le créneau
        </p>
        <ul class="players">
          @for (player of unassigned(); track player.participantId) {
            <li
              [appPlayerPill]="player"
              [choosable]="!draw().published"
              [chosen]="player.participantId === chosen()?.participantId"
              (choose)="toggleChoice(player)"
            ></li>
          }
        </ul>
        @if (cancelledGameMasterLines().length) {
          <ul class="sign-ups" aria-label="Inscriptions des MJ des parties annulées">
            @for (line of cancelledGameMasterLines(); track line) {
              <li>{{ line }}</li>
            }
          </ul>
        }
        @if (chosen(); as player) {
          @if (player.gameId !== null) {
            <div class="gesture">
              <button
                type="button"
                appButton="secondary"
                class="target"
                (click)="move(player, null)"
              >
                Retirer de sa table
              </button>
            </div>
          }
        }
      </li>
      @for (card of cards(); track card.game.id) {
        <li
          class="card"
          [class.second-slot]="card.kind === 'second-slot'"
          [class.cancelled]="card.kind === 'drawn' && card.figures.cancelled"
        >
          <p class="table">{{ card.table.name }}</p>
          <h3>{{ card.game.scenario.title }}</h3>
          <p class="meta">
            {{ card.game.scenario.system }} · {{ card.game.scenario.gameMaster.nickname }}
          </p>
          @switch (card.kind) {
            @case ('drawn') {
              @if (!card.figures.cancelled) {
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
              }
              <div class="badges">
                @if (card.game.timeSlotIds.length > 1) {
                  <app-two-slot-badge />
                }
                @if (card.figures.cancelled) {
                  <span class="badge cancelled-badge"><app-icon name="x" />Annulée</span>
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
              @if (card.figures.cancelled) {
                <p>Ses joueurs sont passés dans les non placés.</p>
              }
            }
            @case ('second-slot') {
              <p class="meta">Partie double, tirée avec le créneau {{ card.rank }}</p>
            }
          }
          <ul class="players">
            @for (player of card.players; track player.participantId) {
              <li
                [appPlayerPill]="player"
                [choosable]="card.kind === 'drawn' && !draw().published"
                [chosen]="player.participantId === chosen()?.participantId"
                (choose)="toggleChoice(player)"
              ></li>
            }
          </ul>
          @if (card.kind === 'drawn' && !draw().published) {
            <div class="gesture">
              @if (card.figures.cancelled) {
                <button
                  type="button"
                  appButton="quiet"
                  (click)="restoreGame.emit({ game: card.game, figures: card.figures })"
                >
                  Rétablir la partie
                </button>
              } @else if (card.figures.cancellable) {
                <button
                  type="button"
                  appButton="quiet-danger"
                  (click)="cancelGame.emit({ game: card.game, figures: card.figures })"
                >
                  Annuler la partie
                </button>
              }
              @if (chosen(); as player) {
                @if (!card.figures.cancelled && player.gameId !== card.game.id) {
                  @if (card.figures.playerCount + 1 > card.game.seats.max) {
                    <p class="warning">
                      {{ countOf(card.figures.playerCount + 1, 'joueur', 'joueurs') }} pour
                      {{ countOf(card.game.seats.max, 'place', 'places') }}
                    </p>
                  }
                  @let signedUp = player.signedUpGameIds.includes(card.game.id);
                  <button
                    type="button"
                    appButton="secondary"
                    class="target"
                    [class.signed-up]="signedUp"
                    (click)="move(player, { game: card.game, table: card.table })"
                  >
                    Déplacer ici · {{ signedUp ? 'inscrit' : 'pas inscrit' }}
                  </button>
                }
              }
            </div>
          }
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

      .sign-ups {
        margin: 0;
        padding: 0;
        list-style: none;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .card.unassigned {
        border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
        background: color-mix(in srgb, var(--danger) 8%, var(--surface-2));
      }

      .card.second-slot,
      .card.cancelled {
        opacity: 0.6;
      }

      .banner {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs) var(--space-m);
        align-items: center;
        margin-bottom: var(--space-m);

        p {
          margin: 0;
        }
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-m);
        color: var(--text-muted);
        font-size: var(--font-size-meta);

        span {
          display: inline-flex;
          gap: var(--space-xxs);
          align-items: center;
        }
      }

      /*
       * Les gestes d'une carte, tout en bas : à la même hauteur d'une carte à l'autre. « Annuler la
       * partie » ou « Rétablir la partie » au-dessus de la cible de déplacement.
       */
      .gesture {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        align-items: flex-start;
        margin-top: auto;
      }

      /* Une cible de déplacement : toute la largeur, de la même taille d'une carte à l'autre. */
      .target {
        align-self: stretch;
        border-style: dashed;
      }

      .target.signed-up {
        border-style: solid;
        border-color: var(--accent);
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

      .cancelled-badge {
        background: color-mix(in srgb, var(--danger) 14%, transparent);
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
  /** « Annuler la partie » : la page demande confirmation, puis fait le geste. */
  readonly cancelGame = output<DrawnGame>();
  /** « Rétablir la partie » : sans confirmation. */
  readonly restoreGame = output<DrawnGame>();
  /**
   * « Déplacer ici » ou « Retirer de sa table » : la page fait le geste, sans confirmation, puis
   * défait le choix s'il réussit.
   */
  readonly moveParticipant = output<ParticipantMove>();

  protected readonly countOf = countOf;
  protected readonly formatCount = formatCount;
  protected readonly formatSeats = formatSeats;

  protected readonly draw = computed(() => this.timeSlot().draw as DrawTrackingDto);

  /** Le joueur choisi, gardé d'une relecture à l'autre, oublié d'un créneau à l'autre. */
  private readonly chosenId = linkedSignal<string, string | null>({
    source: () => this.timeSlot().id,
    computation: () => null,
  });
  /** Le joueur choisi, tant qu'il reste dans le tirage. */
  protected readonly chosen = computed(() =>
    this.draw().assignments.find(({ participantId }) => participantId === this.chosenId()),
  );
  /** « Bastou · inscriptions : « Néons ». Choisis sa nouvelle table. », ou « · sans partie. ». */
  protected readonly chosenSummary = computed(() => {
    const player = this.chosen();
    if (!player) return '';
    if (player.withoutGame || !player.signedUpGameIds.length) {
      return fr`${player.nickname} · sans partie. Choisis sa nouvelle table.`;
    }
    return fr`${player.nickname} · inscriptions : ${this.titlesOf(player.signedUpGameIds)}. Choisis sa nouvelle table.`;
  });

  /**
   * « Kaïros · inscrit à : « Brumes », « Néons » » : les inscriptions, devenues actives, de chaque
   * MJ non placé d'une partie annulée, pour aider à le placer (TI-6, IN-4).
   */
  protected readonly cancelledGameMasterLines = computed(() =>
    this.unassigned()
      .filter((player) => player.gameMasterOfCancelledGame && !player.withoutGame)
      .map(
        (player) => fr`${player.nickname} · inscrit à : ${this.titlesOf(player.signedUpGameIds)}`,
      ),
  );

  /** « « Brumes », « Néons » » : les titres de ces parties du créneau. */
  private titlesOf(gameIds: readonly string[]): string {
    return gameIds
      .map((gameId) => this.games().find(({ id }) => id === gameId)?.scenario.title)
      .filter((title) => title !== undefined)
      .map((title) => fr`« ${title} »`)
      .join(', ');
  }

  protected toggleChoice(player: AssignmentDto) {
    this.chosenId.update((id) => (id === player.participantId ? null : player.participantId));
  }

  /** Défait le choix : « Annuler », Échap, ou le déplacement réussi, que la page fait. */
  dropChoice() {
    this.chosenId.set(null);
  }

  /** Le choix reste jusqu'au déplacement réussi : un refus le garde. */
  protected move(participant: AssignmentDto, target: ParticipantMove['target']) {
    this.moveParticipant.emit({ participant, target });
  }

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
