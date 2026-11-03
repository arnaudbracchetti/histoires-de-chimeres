import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { RouterLink } from '@angular/router';
import {
  drawEndpoints,
  signUpTrackingEndpoints,
  type ScheduleDto,
  type ScheduleScenarioDto,
  type SignUpWarningCode,
  type SignUpWarningDto,
  type SignUpWarningLevel,
  type TableDto,
  type TimeSlotStateDto,
  type TimeSlotTrackingDto,
  type TrackedGameDto,
  type TrackedParticipantDto,
} from '@chimeres/contract';
import {
  countOf,
  formatCount,
  formatSeatRange,
  formatTimeRange,
  fr,
  plural,
  timeSlotLabel,
} from '@chimeres/design';
import { injectApiCall } from '../api-call';
import { apiResource } from '../api-resource';
import { injectGesture } from '../gesture';
import { liveResource } from '../live-resource';
import { CellPlacements } from '../schedule/cell-placement-dialog';
import { GameSheet } from '../schedule/game-sheet';
import {
  describeMovedGame,
  describeScheduledGame,
  describeUnscheduledGame,
} from '../schedule/gesture-announcements';
import { Placements } from '../schedule/placement-dialog';
import { RemovedSignUpsGestures } from '../schedule/removed-sign-ups-gestures';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Confirmation } from '../ui/confirmation';
import { EmptyState } from '../ui/empty-state';
import { Gauge } from '../ui/gauge';
import { Icon } from '../ui/icon';
import { DrawPlan } from './draw-plan';
import { TrackedGameSignUps } from './tracked-game-sign-ups';
import { rowIdOf, TrackedGamesPanel } from './tracked-games-panel';
import {
  keepParticipantFilter,
  type ParticipantFilter,
  TrackedParticipantsPanel,
} from './tracked-participants-panel';
import { TrackedReservePanel } from './tracked-reserve-panel';

/** Les onglets du créneau : « Parties du créneau », « Inscrits du créneau » et « Réserve du créneau ». */
type TabValue = 'games' | 'participants' | 'reserve';

/** L'état d'un créneau lancé, sur sa tuile et dans son résumé, avec son icône. */
const CLOSED_STATE: Record<
  Exclude<TimeSlotStateDto, 'sign-ups-open'>,
  { label: string; icon: string }
> = {
  drawing: { label: 'Tirage provisoire', icon: 'hourglass' },
  published: { label: 'Tirage publié', icon: 'lock' },
};

/** L'icône de chaque niveau d'avertissement de suivi (docs/design/patterns.md, Statuts). */
const WARNING_ICONS: Record<SignUpWarningLevel, string> = {
  danger: 'octagon-alert',
  warning: 'triangle-alert',
};

/**
 * Ce que la page fait de chaque avertissement de suivi : le libellé de son bouton, l'onglet où il
 * mène, la puce qu'il y choisit parmi les inscrits, et s'il remplit en jaune la jauge du créneau.
 */
const WARNING_ACTIONS: Record<
  SignUpWarningCode,
  { label: string; tab: TabValue; participantFilter?: ParticipantFilter; shortfall: boolean }
> = {
  'seats-missing': { label: 'Voir la réserve', tab: 'reserve', shortfall: false },
  'participants-without-game': {
    label: 'Voir les participants',
    tab: 'participants',
    participantFilter: 'without-game',
    shortfall: false,
  },
  'nearly-full': { label: 'Voir la réserve', tab: 'reserve', shortfall: true },
  'participants-may-not-be-placed': {
    label: 'Voir les participants',
    tab: 'participants',
    participantFilter: 'may-not-be-placed',
    shortfall: false,
  },
  'too-many-games': { label: 'Voir les parties', tab: 'games', shortfall: true },
  'games-below-minimum': { label: 'Voir les parties', tab: 'games', shortfall: false },
};

/** Ce que dit le résumé d'un créneau lancé. */
const CLOSED_SUMMARY: Record<Exclude<TimeSlotStateDto, 'sign-ups-open'>, string> = {
  drawing: fr`Les inscriptions du créneau sont fermées. Personne n'est notifié avant la publication.`,
  published: fr`Tirage publié : les inscriptions sont fermées et le programme du créneau ne change plus.`,
};

/**
 * Pilotage du jour J (docs/design/patterns.md) : la bande des créneaux de la journée, avec la
 * demande et la capacité de chacun, le résumé du créneau choisi, ses onglets, et la fiche de la
 * partie à droite. La page affiche ce que l'API calcule, sans recalcul. Elle se relit seule, en
 * silence (`liveResource()`) : toutes les 30 s, au retour sur l'onglet et après chaque geste.
 */
@Component({
  selector: 'app-sign-up-tracking-page',
  imports: [
    Button,
    DrawPlan,
    EmptyState,
    GameSheet,
    Gauge,
    Icon,
    Loadable,
    PageHeader,
    RouterLink,
    Tab,
    TabContent,
    TabList,
    TabPanel,
    Tabs,
    TrackedGameSignUps,
    TrackedGamesPanel,
    TrackedParticipantsPanel,
    TrackedReservePanel,
  ],
  template: `
    <app-page-header title="Pilotage du jour J">
      <p appPageSubtitle class="freshness">
        @if (tracking.ageLine(); as line) {
          <button type="button" (click)="tracking.reload()">{{ line }}</button>
        }
      </p>
    </app-page-header>
    <app-loadable
      [resource]="tracking.firstRead"
      failure="Impossible de charger le suivi des inscriptions."
    >
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
                [class.closed]="slot.state === 'published'"
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
                    [shortfall]="isShortfall(slot)"
                    overflow="danger"
                  />
                  @if (slot.warnings.length) {
                    <span class="warning-count" [class.danger]="isDanger(slot)"
                      ><app-icon [name]="warningIcons[isDanger(slot) ? 'danger' : 'warning']" />{{
                        countOf(slot.warnings.length, 'avertissement', 'avertissements')
                      }}</span
                    >
                  }
                } @else {
                  @if (slot.draw; as draw) {
                    <span class="ratio"
                      >{{ formatCount(draw.assignedCount) }}&nbsp;/&nbsp;{{
                        formatCount(draw.participantCount)
                      }}</span
                    >
                    <span class="legend">placés / participants</span>
                  }
                  <span class="state" [class]="slot.state"
                    ><app-icon [name]="closedState[slot.state].icon" />{{
                      closedState[slot.state].label
                    }}</span
                  >
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
                      [shortfall]="isShortfall(slot)"
                      overflow="danger"
                    />
                    @if (!slot.demand) {
                      <p class="quiet">Aucune inscription sur ce créneau pour l'instant.</p>
                    }
                    @if (slot.id === drawableSlot()?.id) {
                      <p>
                        <button type="button" appButton="primary" (click)="launch(slot)">
                          Lancer le tirage
                        </button>
                      </p>
                    } @else if (drawableSlot(); as drawable) {
                      <p class="quiet">
                        Le tirage de ce créneau se lance après la publication du créneau
                        {{ drawable.rank }}.
                      </p>
                    }
                    @if (slot.warnings.length) {
                      <ul class="warnings" aria-label="Avertissements de suivi">
                        @for (warning of slot.warnings; track warning.code) {
                          <li [class]="warning.level">
                            <app-icon [name]="warningIcons[warning.level]" />
                            <p>
                              <span class="title">{{ warning.title }}</span>
                              <span class="detail">{{ warning.detail }}</span>
                            </p>
                            <button type="button" appButton="secondary" (click)="follow(warning)">
                              {{ warningActions[warning.code].label }}
                            </button>
                          </li>
                        }
                      </ul>
                    }
                  } @else {
                    @if (slot.state === 'drawing') {
                      <p class="state drawing">
                        <app-icon [name]="closedState.drawing.icon" />{{
                          closedState.drawing.label
                        }}
                      </p>
                    }
                    @if (slot.draw; as draw) {
                      <p class="figures">
                        <span
                          ><span class="figure"
                            >{{ formatCount(draw.assignedCount) }}&nbsp;/&nbsp;{{
                              formatCount(draw.participantCount)
                            }}</span
                          >&nbsp;{{ plural(draw.assignedCount, 'placé', 'placés') }}</span
                        >
                        <span
                          ><span class="figure">{{ formatCount(draw.unassignedCount) }}</span
                          >&nbsp;{{ plural(draw.unassignedCount, 'non placé', 'non placés') }}</span
                        >
                        <span
                          ><span class="figure"
                            >{{ formatCount(draw.gamesAtMinimumCount) }}&nbsp;/&nbsp;{{
                              formatCount(draw.gameCount)
                            }}</span
                          >&nbsp;{{ plural(draw.gameCount, 'partie', 'parties') }} au minimum</span
                        >
                      </p>
                    }
                    <p class="quiet">{{ closedSummary[slot.state] }}</p>
                  }
                </section>
                @if (slot.draw) {
                  <app-draw-plan
                    [timeSlot]="slot"
                    [timeSlots]="tracking.timeSlots"
                    [tables]="tracking.tables"
                    [games]="tracking.games"
                  />
                } @else if (slot.state === 'sign-ups-open') {
                  <div ngTabs class="binder">
                    <div ngTabList aria-label="Vues du créneau" [(selectedTab)]="selectedTab">
                      <button ngTab id="tab-games" type="button" value="games">
                        <app-icon name="dices" />Parties du créneau
                        <span class="count">{{ formatCount(gamesOf(slot).length) }}</span>
                      </button>
                      <button ngTab id="tab-participants" type="button" value="participants">
                        <app-icon name="users" />Inscrits du créneau
                        <span class="count">{{ formatCount(slot.demand) }}</span>
                      </button>
                      <button ngTab id="tab-reserve" type="button" value="reserve">
                        <app-icon name="inbox" />Réserve du créneau
                        <span class="count">{{ formatCount(schedulableCountOf(slot)) }}</span>
                      </button>
                    </div>
                    <div ngTabPanel value="games" class="panel">
                      <ng-template ngTabContent>
                        <app-tracked-games-panel
                          [timeSlot]="slot"
                          [timeSlots]="tracking.timeSlots"
                          [tables]="tracking.tables"
                          [games]="tracking.games"
                          [openGameId]="openGame()?.id ?? null"
                          (opened)="open($event)"
                          (scheduleOn)="scheduleOnTable(slot, $event)"
                        />
                      </ng-template>
                    </div>
                    <div ngTabPanel value="participants" class="panel">
                      <ng-template ngTabContent>
                        <app-tracked-participants-panel
                          [timeSlot]="slot"
                          [tables]="tracking.tables"
                          [games]="tracking.games"
                          [openGameId]="openGame()?.id ?? null"
                          [(filter)]="participantFilter"
                          (opened)="open($event)"
                        />
                      </ng-template>
                    </div>
                    <div ngTabPanel value="reserve" class="panel">
                      <ng-template ngTabContent>
                        <app-tracked-reserve-panel
                          [timeSlot]="slot"
                          [timeSlots]="tracking.timeSlots"
                          [reserve]="tracking.reserve"
                          (scheduleOn)="scheduleOn(slot, $event)"
                        />
                      </ng-template>
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
              >
                <app-tracked-game-sign-ups
                  [game]="game"
                  [timeSlots]="tracking.timeSlots"
                  [games]="tracking.games"
                />
              </app-game-sheet>
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

        button {
          padding: 0;
          border: none;
          background: none;
          color: inherit;
          font: inherit;
          text-decoration: underline;
          cursor: pointer;
        }
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

      .warning-count {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        margin-top: var(--space-xs);
        color: var(--warning);
        font-size: var(--font-size-meta);

        &.danger {
          color: var(--danger);
        }
      }

      /* Un avertissement par ligne : icône, titre en couleur, détail en gris, et son bouton. */
      .warnings {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        margin: 0;
        padding: 0;
        list-style: none;

        li {
          display: flex;
          gap: var(--space-s);
          align-items: center;
        }

        p {
          display: flex;
          flex: 1;
          flex-wrap: wrap;
          gap: 0 var(--space-s);
          align-items: baseline;
        }

        .title {
          font-weight: 600;
        }

        .detail {
          color: var(--text-muted);
        }

        .danger :is(app-icon, .title) {
          color: var(--danger);
        }

        .warning :is(app-icon, .title) {
          color: var(--warning);
        }
      }

      .state {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        margin-top: var(--space-xs);
        color: var(--text-muted);

        &.drawing {
          color: var(--accent);
        }
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
  /** Le suivi, relu toutes les 30 s, au retour sur l'onglet et après chaque geste. */
  protected readonly tracking = liveResource(apiResource(signUpTrackingEndpoints.read));
  protected readonly value = this.tracking.value;
  protected readonly closedState = CLOSED_STATE;
  protected readonly closedSummary = CLOSED_SUMMARY;
  protected readonly countOf = countOf;
  protected readonly formatCount = formatCount;
  protected readonly warningIcons = WARNING_ICONS;
  protected readonly warningActions = WARNING_ACTIONS;
  protected readonly formatSeatRange = formatSeatRange;
  protected readonly timeSlotLabel = timeSlotLabel;
  protected readonly plural = plural;

  /**
   * Le premier créneau dont le tirage n'est pas publié : le seul qui se lance, s'il est ouvert. Les
   * tirages se font dans l'ordre de la journée.
   */
  protected readonly drawableSlot = computed(() =>
    this.value()?.timeSlots.find(({ state }) => state !== 'published'),
  );

  /** Le créneau choisi d'un clic ; avant, le premier dont le tirage n'est pas publié. */
  protected readonly selectedId = signal<string | undefined>(undefined);
  protected readonly selected = computed(() => {
    const timeSlots = this.value()?.timeSlots ?? [];
    return (
      timeSlots.find(({ id }) => id === this.selectedId()) ?? this.drawableSlot() ?? timeSlots[0]
    );
  });

  /** L'onglet ouvert, gardé d'un créneau à l'autre. */
  protected readonly selectedTab = signal<TabValue | undefined>('games');

  /** Le filtre des inscrits, gardé à la relecture tant que sa puce existe. */
  protected readonly participantFilter = linkedSignal<
    readonly TrackedParticipantDto[],
    ParticipantFilter
  >({
    source: () => this.selected()?.participants ?? [],
    computation: (participants, previous) => keepParticipantFilter(participants, previous?.value),
  });

  private readonly openGameId = signal<string | null>(null);
  /** La partie dont la fiche est ouverte ; une partie disparue du programme la ferme. */
  protected readonly openGame = computed(() =>
    this.value()?.games.find(({ id }) => id === this.openGameId()),
  );
  /** Un refus part en alerte : la fiche n'a pas de place pour lui. */
  protected readonly unscheduling = injectGesture({ alert: true, refreshes: true });
  private readonly confirmation = inject(Confirmation);
  private readonly apiCall = injectApiCall();
  private readonly placements = inject(Placements);
  private readonly cellPlacements = inject(CellPlacements);
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

  /** Le plus grave des avertissements du créneau est rouge : l'icône de sa tuile. */
  protected isDanger(slot: TimeSlotTrackingDto): boolean {
    return slot.warnings.some(({ level }) => level === 'danger');
  }

  /** La jauge du créneau se remplit en jaune : il porte `nearly-full` ou `too-many-games`. */
  protected isShortfall(slot: TimeSlotTrackingDto): boolean {
    return slot.warnings.some(({ code }) => WARNING_ACTIONS[code].shortfall);
  }

  /**
   * Mène à l'onglet où agir sur l'avertissement, et y met le focus : « Voir les participants »
   * filtre les inscrits sur la puce « Sans partie » ou « Risquent de ne pas être placés ».
   */
  protected follow(warning: SignUpWarningDto) {
    const { tab, participantFilter } = WARNING_ACTIONS[warning.code];
    if (participantFilter) this.participantFilter.set(participantFilter);
    this.selectedTab.set(tab);
    this.focusById(`tab-${tab}`);
  }

  /**
   * Lance le tirage du créneau, après une confirmation qui rappelle ses inscrits, ses places et ses
   * avertissements de suivi rouges. Le suivi se relit ensuite, et la région `aria-live` l'annonce.
   */
  protected async launch(slot: TimeSlotTrackingDto) {
    const launched = await this.confirmation.ask({
      question: fr`Lancer le tirage du créneau ${slot.rank} ?`,
      consequences: [
        fr`${countOf(slot.demand, 'participant', 'participants')} ${plural(slot.demand, 'est inscrit', 'sont inscrits')} sur ce créneau, pour ${formatSeatRange(slot.capacity)} ${this.places(slot.capacity.max)}.`,
        ...slot.warnings
          .filter(({ level }) => level === 'danger')
          .map(({ title, detail }) => fr`${title}. ${detail}`),
        fr`Les inscriptions du créneau seront fermées. Personne n'est notifié avant la publication.`,
      ],
      confirmLabel: 'Lancer le tirage',
      tone: 'primary',
      action: () => this.apiCall(drawEndpoints.launch, { params: { timeSlotId: slot.id } }),
      onStale: () => this.tracking.reload(),
    });
    if (!launched) return;
    this.announcer.announce(`Tirage du créneau ${slot.rank} lancé.`);
    this.tracking.reload();
  }

  /** Les scénarios programmables sur le créneau : le compteur de l'onglet Réserve. */
  protected schedulableCountOf(slot: TimeSlotTrackingDto): number {
    return slot.reserve.filter(({ refusal }) => !refusal).length;
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
    const outcome = await this.placements.moveTo({
      game,
      games,
      timeSlots,
      tables,
      currentSignUpFigures: this.currentSignUpFigures,
    });
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
   * Ouvre le dialogue de placement du scénario, limité à la colonne du créneau : voir
   * `concludeScheduling()`.
   */
  protected async scheduleOn(slot: TimeSlotTrackingDto, scenario: ScheduleScenarioDto) {
    await this.concludeScheduling(
      slot,
      this.placements.scheduleOn({ scenario, timeSlots: [slot], tables: this.value()!.tables }),
    );
  }

  /**
   * Ouvre le dialogue de « Programmer ici… » sur la table libre du créneau : voir
   * `concludeScheduling()`.
   */
  protected async scheduleOnTable(slot: TimeSlotTrackingDto, table: TableDto) {
    await this.concludeScheduling(slot, this.cellPlacements.scheduleOn({ timeSlot: slot, table }));
  }

  /**
   * Attend le dialogue de programmation sur le créneau. Une fois la partie programmée, la page
   * ouvre l'onglet Parties, et met le focus sur sa ligne, une fois le suivi relu ; la région
   * `aria-live` l'annonce.
   */
  private async concludeScheduling(
    slot: TimeSlotTrackingDto,
    dialog: Promise<ScheduleDto | undefined>,
  ) {
    const { tables, games } = this.value()!;
    const known = new Set(games.map(({ id }) => id));
    const schedule = await dialog;
    // Fermé sans geste, le dialogue a pu essuyer un refus périmé : le suivi se relit aussi.
    const game = schedule?.games.find(({ id }) => !known.has(id));
    if (game) {
      this.announcer.announce(describeScheduledGame(game, [slot], tables));
      this.selectedTab.set('games');
      this.focusAfterReading.set(rowIdOf(game.id));
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
    const schedule = await this.gestures.unschedule(
      game,
      timeSlots,
      this.unscheduling,
      () => this.tracking.reload(),
      this.currentSignUpFigures,
    );
    if (!schedule) return;
    this.openGameId.set(null);
    this.announcer.announce(describeUnscheduledGame(game));
    this.focusById('summary-title');
    this.tracking.reload();
  }

  /**
   * Les chiffres du suivi de la partie, sur son premier créneau, à la dernière lecture : un dialogue
   * de confirmation ouvert les suit à chaque relecture.
   */
  private readonly currentSignUpFigures = (gameId: string) =>
    this.value()?.games.find(({ id }) => id === gameId);

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
