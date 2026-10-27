import {
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  scheduleEndpoints,
  type ConventionDto,
  type GameDto,
  type ScheduleDto,
  type ScheduleScenarioDto,
} from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { apiResource } from '../api-resource';
import { ConventionStore } from '../convention/convention-store';
import { injectGesture } from '../gesture';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { fr } from '../typography/french';
import { GameSheet } from './game-sheet';
import { Placements } from './placement-dialog';
import { ReserveTray } from './reserve-tray';
import {
  ScheduleDrag,
  type DragSubject,
  type Drop,
  type DropTarget,
  type Place,
} from './schedule-drag';
import { ScheduleTimeline } from './schedule-timeline';

/**
 * La frise du programme, sa barre d'aide au-dessus, la fiche de la partie à sa droite, et le bac
 * de réserve dessous (docs/design/patterns.md, Programmation). La page ne l'affiche qu'avec des créneaux et des
 * tables : le programme se lit à ce moment-là.
 */
@Component({
  selector: 'app-schedule-board',
  imports: [GameSheet, Loadable, ReserveTray, ScheduleTimeline],
  providers: [ScheduleDrag],
  template: `
    <app-loadable [resource]="schedule" failure="Impossible de charger le programme.">
      @if (schedule.hasValue()) {
        <div class="board">
          <!-- Ligne réservée : la phrase du motif survolé ne décale rien. -->
          <p class="help">{{ drag.help() }}</p>
          <div class="programme">
            <app-schedule-timeline
              [timeSlots]="convention().timeSlots"
              [tables]="convention().tables"
              [games]="games()"
              [pendingGameIds]="pending()?.gameIds ?? []"
              [selectedGameId]="selected()?.id ?? null"
              (opened)="open($event)"
              (dropped)="drop($event)"
            />
            @if (selected(); as game) {
              <app-game-sheet
                [attr.aria-busy]="unscheduling.running()"
                [game]="game"
                [timeSlots]="convention().timeSlots"
                [tables]="convention().tables"
                (closed)="close(game)"
                (moveRequested)="move(game)"
                (unscheduleRequested)="unschedule(game)"
              />
            }
          </div>
        </div>
        <section aria-labelledby="reserve-title">
          <h2 id="reserve-title" tabindex="-1">Réserve</h2>
          <app-reserve-tray
            [timeSlots]="convention().timeSlots"
            [reserve]="schedule.value().reserve"
            (scheduleOn)="scheduleOn($event)"
            (dropped)="drop($event)"
          />
        </section>
      }
    </app-loadable>
  `,
  styles: `
    @layer components {
      :host {
        display: block;
      }

      app-loadable {
        display: flex;
        flex-direction: column;
        gap: var(--space-xl);
      }

      /* La barre d'aide, au-dessus de la frise. */
      .board {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
      }

      .help {
        min-height: 1lh;
        color: var(--text-muted);
      }

      /* La fiche ouverte rétrécit la frise. */
      .programme {
        display: flex;
        gap: var(--space-m);
        align-items: flex-start;
      }

      app-schedule-timeline {
        flex: 1;
        min-width: 0;
      }

      app-game-sheet {
        flex: none;
        width: 20rem;
      }

      section {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }
    }
  `,
})
export class ScheduleBoard {
  readonly convention = input.required<ConventionDto>();

  protected readonly schedule = apiResource(scheduleEndpoints.read);
  /** Le programme tel qu'un glisser-déposer le laisse, pendant son écriture. */
  protected readonly pending = signal<Pending | null>(null);
  protected readonly games = computed(
    () => this.pending()?.games ?? this.schedule.value()?.games ?? [],
  );
  private readonly selectedId = signal<string | null>(null);
  /** La partie dont la fiche est ouverte ; une partie disparue du programme la ferme. */
  protected readonly selected = computed(() =>
    this.schedule.value()?.games.find(({ id }) => id === this.selectedId()),
  );
  private readonly sheet = viewChild(GameSheet);
  private readonly placements = inject(Placements);
  private readonly announcer = inject(Announcer);
  private readonly store = inject(ConventionStore);
  private readonly apiCall = injectApiCall();
  private readonly injector = inject(Injector);
  protected readonly drag = inject(ScheduleDrag);
  /** Un refus part en alerte : la fiche n'a pas de place pour lui. */
  protected readonly unscheduling = injectGesture({ alert: true, refreshes: true });
  /** Un glisser-déposer refusé part aussi en alerte. */
  private readonly dropping = injectGesture({ alert: true, refreshes: true });

  /**
   * Ouvre le dialogue de placement. Une fois la partie programmée, le focus va à sa carte, et la
   * région `aria-live` l'annonce.
   */
  protected async scheduleOn(scenario: ScheduleScenarioDto) {
    const { timeSlots, tables } = this.convention();
    const known = this.gameIds();
    const schedule = await this.placements.scheduleOn({ scenario, timeSlots, tables });
    if (schedule) this.scheduled(schedule, known, scenario);
  }

  /** Ouvre la fiche de la partie, et y met le focus. */
  protected open(game: GameDto) {
    this.selectedId.set(game.id);
    afterNextRender(() => this.sheet()?.focus(), { injector: this.injector });
  }

  /** Ferme la fiche : le focus revient à la partie. */
  protected close(game: GameDto) {
    this.selectedId.set(null);
    this.focusGame(game.id);
  }

  /**
   * Ouvre le dialogue de placement de la partie. Une fois déplacée ou échangée, le focus va à sa
   * carte, à sa nouvelle place, et la région `aria-live` l'annonce. La fiche reste ouverte.
   */
  protected async move(game: GameDto) {
    const { timeSlots, tables } = this.convention();
    const outcome = await this.placements.moveTo({ game, timeSlots, tables });
    if (outcome) this.moved(outcome.schedule, game.id, outcome.swappedWith);
  }

  /**
   * Déprogramme la partie, sans confirmation (docs/design/patterns.md, Actions destructrices). La
   * fiche se ferme, et le focus va à la réserve, où revient son scénario. Un refus s'affiche en
   * alerte ; s'il dit l'écran périmé, la convention et le programme se relisent.
   */
  protected async unschedule(game: GameDto) {
    const outcome = await this.unscheduling.run(() => this.unscheduleCall(game));
    if (outcome.status === 'refused' && outcome.refusal.stale) this.refresh();
    if (outcome.status === 'done') this.unscheduled(outcome.value, game);
  }

  /**
   * Écrit un glisser-déposer : programmer, déplacer, échanger ou déprogrammer. Pendant l'écriture,
   * le programme montre son résultat, les parties concernées atténuées ; refusé, il revient à son
   * état, le refus part en alerte, et s'il dit l'écran périmé, la convention et le programme
   * se relisent. Pas d'annulation : on refait le geste inverse.
   */
  protected async drop({ subject, target }: Drop) {
    const schedule = this.schedule.value();
    if (!schedule || this.dropping.running()) return;
    const known = this.gameIds();
    this.pending.set(this.pendingAfter(schedule.games, subject, target));
    const outcome = await this.dropping.run(() => this.writeDrop(subject, target));
    this.pending.set(null);
    if (outcome.status === 'refused' && outcome.refusal.stale) this.refresh();
    if (outcome.status !== 'done') return;
    if (subject.kind === 'scenario') this.scheduled(outcome.value, known, subject.scenario);
    else if (target.kind === 'reserve') this.unscheduled(outcome.value, subject.game);
    else this.moved(outcome.value, subject.game.id, swapGameId(subject.game, target));
  }

  private writeDrop(subject: DragSubject, target: DropTarget): Promise<ScheduleDto> {
    if (subject.kind === 'scenario') {
      if (target.kind !== 'cell') throw new Error('Un scénario ne se dépose que sur une case.');
      const { timeSlotId, tableId } = target;
      return this.apiCall(scheduleEndpoints.schedule, {
        body: { scenarioId: subject.scenario.id, timeSlotId, tableId },
      });
    }
    const { game } = subject;
    if (target.kind === 'reserve') return this.unscheduleCall(game);
    const params = { gameId: game.id };
    const otherGameId = swapGameId(game, target);
    if (otherGameId) return this.apiCall(scheduleEndpoints.swap, { params, body: { otherGameId } });
    const { timeSlotId, tableId } = target;
    return this.apiCall(scheduleEndpoints.move, { params, body: { timeSlotId, tableId } });
  }

  /** Les parties après le geste, tel que la frise les montre pendant son écriture. */
  private pendingAfter(
    games: readonly GameDto[],
    subject: DragSubject,
    target: DropTarget,
  ): Pending {
    if (subject.kind === 'scenario') {
      if (target.kind !== 'cell') return { games, gameIds: [] };
      const { scenario } = subject;
      const game: GameDto = {
        id: PENDING_GAME_ID,
        tableId: target.tableId,
        timeSlotIds: this.slotsFrom(target.timeSlotId, scenario.duration),
        seats: scenario.seats,
        scenario,
      };
      return { games: [...games, game], gameIds: [game.id] };
    }
    const { game } = subject;
    if (target.kind === 'reserve') {
      return { games: games.filter(({ id }) => id !== game.id), gameIds: [] };
    }
    const other = games.find(({ id }) => id === swapGameId(game, target));
    const places = new Map([[game.id, this.placedAt(game, target)]]);
    if (other) {
      const place = { timeSlotId: game.timeSlotIds[0]!, tableId: game.tableId };
      places.set(other.id, this.placedAt(other, place));
    }
    return {
      games: games.map((each) => places.get(each.id) ?? each),
      gameIds: [...places.keys()],
    };
  }

  /** La partie à sa nouvelle place : une partie double y prend aussi le créneau suivant. */
  private placedAt(game: GameDto, { timeSlotId, tableId }: Place): GameDto {
    return { ...game, tableId, timeSlotIds: this.slotsFrom(timeSlotId, game.timeSlotIds.length) };
  }

  private slotsFrom(timeSlotId: string, count: number): string[] {
    const slots = this.convention().timeSlots;
    const index = slots.findIndex(({ id }) => id === timeSlotId);
    return slots.slice(index, index + count).map(({ id }) => id);
  }

  private unscheduleCall(game: GameDto): Promise<ScheduleDto> {
    return this.apiCall(scheduleEndpoints.unschedule, { params: { gameId: game.id } });
  }

  /** Le refus disait l'écran périmé : la convention et le programme se relisent. */
  private refresh() {
    this.store.convention.reload();
    this.schedule.reload();
  }

  private gameIds(): ReadonlySet<string> {
    return new Set(this.schedule.value()?.games.map(({ id }) => id));
  }

  /** La nouvelle partie du scénario : la région `aria-live` l'annonce, et le focus va à sa carte. */
  private scheduled(
    schedule: ScheduleDto,
    known: ReadonlySet<string>,
    scenario: ScheduleScenarioDto,
  ) {
    const { timeSlots, tables } = this.convention();
    this.schedule.set(schedule);
    const game = schedule.games.find(({ id }) => !known.has(id));
    if (!game) return;
    const slot = timeSlots.find(({ id }) => id === game.timeSlotIds[0]);
    const table = tables.find(({ id }) => id === game.tableId);
    this.announcer.announce(
      fr`Partie « ${scenario.title} » programmée : créneau ${slot?.rank}, ${table?.name}.`,
    );
    this.focusGame(game.id);
  }

  /** La partie déplacée, ou échangée avec `swappedWith` : annoncée, et focalisée à sa place. */
  private moved(schedule: ScheduleDto, gameId: string, swappedWith: string | null) {
    const { timeSlots, tables } = this.convention();
    this.schedule.set(schedule);
    const moved = schedule.games.find(({ id }) => id === gameId);
    if (!moved) return;
    const other = schedule.games.find(({ id }) => id === swappedWith);
    if (other) {
      this.announcer.announce(
        fr`Parties « ${moved.scenario.title} » et « ${other.scenario.title} » échangées.`,
      );
    } else {
      const slot = timeSlots.find(({ id }) => id === moved.timeSlotIds[0]);
      const table = tables.find(({ id }) => id === moved.tableId);
      this.announcer.announce(fr`Partie déplacée : créneau ${slot?.rank}, table ${table?.name}.`);
    }
    this.focusGame(moved.id);
  }

  /** La fiche se ferme, et le focus va à la réserve, où revient le scénario. */
  private unscheduled(schedule: ScheduleDto, game: GameDto) {
    this.schedule.set(schedule);
    this.selectedId.set(null);
    this.announcer.announce(fr`Partie « ${game.scenario.title} » déprogrammée.`);
    afterNextRender(() => document.getElementById('reserve-title')?.focus(), {
      injector: this.injector,
    });
  }

  private focusGame(gameId: string) {
    afterNextRender(() => document.getElementById(`game-${gameId}`)?.focus(), {
      injector: this.injector,
    });
  }
}

/** L'id provisoire de la partie qu'un scénario déposé crée, le temps de l'écriture. */
const PENDING_GAME_ID = 'pending';

/** Les parties montrées pendant l'écriture d'un geste, et celles qu'il déplace, atténuées. */
type Pending = { games: readonly GameDto[]; gameIds: readonly string[] };

/** L'autre partie de la case, avec laquelle échanger la partie déposée, ou `null`. */
function swapGameId(game: GameDto, target: DropTarget): string | null {
  return target.kind === 'cell' && target.gameId !== game.id ? target.gameId : null;
}
