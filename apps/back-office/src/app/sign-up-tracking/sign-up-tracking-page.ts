import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Tab, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { RouterLink } from '@angular/router';
import {
  signUpTrackingEndpoints,
  type TimeSlotStateDto,
  type TimeSlotTrackingDto,
  type TrackedGameDto,
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
import { injectGesture } from '../gesture';
import { GameSheet } from '../schedule/game-sheet';
import { describeMovedGame, describeUnscheduledGame } from '../schedule/gesture-announcements';
import { Placements } from '../schedule/placement-dialog';
import { RemovedSignUpsGestures } from '../schedule/removed-sign-ups-gestures';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Gauge } from '../ui/gauge';
import { Icon } from '../ui/icon';
import { rowIdOf, TrackedGamesPanel } from './tracked-games-panel';

/** Les onglets du créneau : « Parties du créneau », pour l'instant. */
type TabValue = 'games';

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
 * demande et la capacité de chacun, le résumé du créneau choisi, ses onglets, et la fiche de la
 * partie à droite. La page affiche ce que l'API calcule, sans recalcul. Après chaque geste, elle
 * relit le suivi.
 */
@Component({
  selector: 'app-sign-up-tracking-page',
  imports: [
    Button,
    EmptyState,
    GameSheet,
    Gauge,
    Icon,
    Loadable,
    PageHeader,
    RouterLink,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    TrackedGamesPanel,
  ],
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
          <div class="workspace">
            @if (selected(); as slot) {
              <div class="slot">
                <section class="summary" aria-labelledby="summary-title">
                  <h2 id="summary-title" tabindex="-1">{{ timeSlotLabel(slot) }}</h2>
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
                @if (slot.state === 'sign-ups-open') {
                  <div ngTabs class="binder">
                    <div ngTabList aria-label="Vues du créneau" [(selectedTab)]="selectedTab">
                      <button ngTab type="button" value="games">
                        <app-icon name="dices" />Parties du créneau
                        <span class="count">{{ formatCount(gamesOf(slot).length) }}</span>
                      </button>
                    </div>
                    <div ngTabPanel value="games" class="panel">
                      <app-tracked-games-panel
                        [timeSlot]="slot"
                        [timeSlots]="tracking.timeSlots"
                        [tables]="tracking.tables"
                        [games]="tracking.games"
                        [openGameId]="openGame()?.id ?? null"
                        (opened)="open($event)"
                      />
                    </div>
                  </div>
                }
              </div>
            }
            @if (openGame(); as game) {
              <app-game-sheet
                [attr.aria-busy]="unscheduling.running()"
                [game]="game"
                [timeSlots]="tracking.timeSlots"
                [tables]="tracking.tables"
                [offersGestures]="areSignUpsOpen(game)"
                (closed)="close(game)"
                (moveRequested)="move(game)"
                (unscheduleRequested)="unschedule(game)"
              />
            }
          </div>
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

      /* La fiche ouverte rétrécit le créneau. */
      .workspace {
        display: flex;
        gap: var(--space-m);
        align-items: flex-start;
      }

      .slot {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: var(--space-l);
        min-width: 0;
      }

      app-game-sheet {
        flex: none;
        width: 20rem;
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

      /* Onglets de classeur : l'onglet choisi est soudé au panneau, marqué d'un trait orange. */
      [ngTabList] {
        display: flex;
        gap: var(--space-xs);
        padding-left: var(--space-m);
      }

      [ngTab] {
        position: relative;
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        margin-bottom: -1px;
        padding: var(--space-s) var(--space-m);
        border: 1px solid transparent;
        border-radius: var(--radius-card) var(--radius-card) 0 0;
        background: none;
        color: var(--text-muted);
        font: inherit;
        cursor: pointer;

        &:hover {
          color: var(--text);
        }

        &[aria-selected='true'] {
          border-color: var(--border);
          border-bottom-color: var(--surface-2);
          background: var(--surface-2);
          box-shadow: inset 0 2px 0 var(--accent);
          color: var(--text);
        }
      }

      .count {
        padding: 0 var(--space-xs);
        border-radius: 999px;
        background: var(--surface-3);
        font-size: var(--font-size-meta);
        font-variant-numeric: tabular-nums;
      }

      .panel {
        padding: var(--space-l);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);

        &[inert] {
          display: none;
        }
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

  /** L'onglet ouvert, gardé d'un créneau à l'autre. */
  protected readonly selectedTab = signal<TabValue | undefined>('games');

  private readonly openGameId = signal<string | null>(null);
  /** La partie dont la fiche est ouverte ; une partie disparue du programme la ferme. */
  protected readonly openGame = computed(() =>
    this.value()?.games.find(({ id }) => id === this.openGameId()),
  );
  /** Un refus part en alerte : la fiche n'a pas de place pour lui. */
  protected readonly unscheduling = injectGesture({ alert: true, refreshes: true });
  private readonly placements = inject(Placements);
  private readonly announcer = inject(Announcer);
  private readonly gestures = inject(RemovedSignUpsGestures);
  private readonly injector = inject(Injector);
  /** L'élément qui reçoit le focus une fois le suivi relu. */
  private readonly focusAfterReading = signal<string | undefined>(undefined);
  private readonly sheet = viewChild(GameSheet);

  constructor() {
    effect(() => {
      const id = this.focusAfterReading();
      if (!id || this.tracking.isLoading()) return;
      untracked(() => this.focusAfterReading.set(undefined));
      this.focusById(id);
    });
  }

  protected gamesOf(slot: TimeSlotTrackingDto): TrackedGameDto[] {
    return (this.value()?.games ?? []).filter(({ timeSlotIds }) => timeSlotIds[0] === slot.id);
  }

  /** Les inscriptions du premier créneau de la partie sont ouvertes : la fiche offre ses gestes. */
  protected areSignUpsOpen(game: TrackedGameDto): boolean {
    const slot = this.value()?.timeSlots.find(({ id }) => id === game.timeSlotIds[0]);
    return slot?.state === 'sign-ups-open';
  }

  /** Ouvre la fiche de la partie, et y met le focus. */
  protected open(game: TrackedGameDto) {
    this.openGameId.set(game.id);
    afterNextRender(() => this.sheet()?.focus(), { injector: this.injector });
  }

  /**
   * Ferme la fiche : le focus revient à la ligne de la partie, ou au titre du résumé si la ligne
   * n'est pas affichée (créneau fermé, ou autre créneau choisi).
   */
  protected close(game: TrackedGameDto) {
    this.openGameId.set(null);
    this.focusById(rowIdOf(game.id), 'summary-title');
  }

  /**
   * Ouvre le dialogue de placement de la partie. Une fois déplacée ou échangée, la page choisit le
   * créneau où elle commence désormais, ouvre l'onglet Parties, et met le focus sur sa ligne, une
   * fois le suivi relu. La région `aria-live` l'annonce.
   */
  protected async move(game: TrackedGameDto) {
    const { timeSlots, tables, games } = this.value()!;
    const outcome = await this.placements.moveTo({ game, games, timeSlots, tables });
    // Fermé sans geste, le dialogue a pu essuyer un refus périmé : le suivi se relit aussi.
    if (!outcome) {
      this.tracking.reload();
      return;
    }
    const moved = outcome.schedule.games.find(({ id }) => id === game.id);
    if (moved) {
      const other = outcome.schedule.games.find(({ id }) => id === outcome.swappedWith);
      this.announcer.announce(describeMovedGame(moved, other, timeSlots, tables));
      this.selectedId.set(moved.timeSlotIds[0]);
      this.selectedTab.set('games');
      this.focusAfterReading.set(rowIdOf(moved.id));
    }
    this.tracking.reload();
  }

  /**
   * Déprogramme la partie : aussitôt, ou après une confirmation si elle a des inscrits
   * (`RemovedSignUpsGestures`), comme dans le Calendrier. La fiche se ferme, le focus va au titre
   * du résumé, et la région `aria-live` l'annonce. Un refus qui dit l'écran périmé relit le suivi.
   */
  protected async unschedule(game: TrackedGameDto) {
    const { timeSlots } = this.value()!;
    const schedule = await this.gestures.unschedule(game, timeSlots, this.unscheduling, () =>
      this.tracking.reload(),
    );
    if (!schedule) return;
    this.openGameId.set(null);
    this.announcer.announce(describeUnscheduledGame(game));
    this.focusById('summary-title');
    this.tracking.reload();
  }

  /** Met le focus sur le premier élément affiché de ces ids. */
  private focusById(...ids: string[]) {
    afterNextRender(
      () =>
        ids
          .map((id) => document.getElementById(id))
          .find((element) => element)
          ?.focus(),
      { injector: this.injector },
    );
  }

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
