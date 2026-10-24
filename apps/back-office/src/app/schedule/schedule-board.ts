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
  type ScheduleScenarioDto,
} from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { apiResource } from '../api-resource';
import { injectGesture } from '../gesture';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { fr } from '../typography/french';
import { GameSheet } from './game-sheet';
import { Placements } from './placement-dialog';
import { ReserveTray } from './reserve-tray';
import { ScheduleTimeline } from './schedule-timeline';

/**
 * La frise du programme, la fiche de la partie à sa droite, et le bac de réserve dessous
 * (docs/design/patterns.md, Programmation). La page ne l'affiche qu'avec des créneaux et des
 * tables : le programme se lit à ce moment-là.
 */
@Component({
  selector: 'app-schedule-board',
  imports: [GameSheet, Loadable, ReserveTray, ScheduleTimeline],
  template: `
    <app-loadable [resource]="schedule" failure="Impossible de charger le programme.">
      @if (schedule.hasValue()) {
        <div class="programme">
          <app-schedule-timeline
            [timeSlots]="convention().timeSlots"
            [tables]="convention().tables"
            [games]="schedule.value().games"
            [selectedGameId]="selected()?.id ?? null"
            (opened)="open($event)"
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
        <section aria-labelledby="reserve-title">
          <h2 id="reserve-title" tabindex="-1">Réserve</h2>
          <app-reserve-tray
            [timeSlots]="convention().timeSlots"
            [reserve]="schedule.value().reserve"
            (scheduleOn)="scheduleOn($event)"
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
  private readonly selectedId = signal<string | null>(null);
  /** La partie dont la fiche est ouverte ; une partie disparue du programme la ferme. */
  protected readonly selected = computed(() =>
    this.schedule.value()?.games.find(({ id }) => id === this.selectedId()),
  );
  private readonly sheet = viewChild(GameSheet);
  private readonly placements = inject(Placements);
  private readonly announcer = inject(Announcer);
  private readonly apiCall = injectApiCall();
  private readonly injector = inject(Injector);
  /** Un refus part en notification : la fiche n'a pas de place pour lui. */
  protected readonly unscheduling = injectGesture({ notify: true });

  /**
   * Ouvre le dialogue de placement. Une fois la partie programmée, le focus va à sa carte, et la
   * région `aria-live` l'annonce.
   */
  protected async scheduleOn(scenario: ScheduleScenarioDto) {
    const { timeSlots, tables } = this.convention();
    const known = new Set(this.schedule.value()?.games.map(({ id }) => id));
    const schedule = await this.placements.scheduleOn({ scenario, timeSlots, tables });
    if (!schedule) return;
    this.schedule.set(schedule);
    const game = schedule.games.find(({ id }) => !known.has(id));
    if (!game) return;
    const slot = timeSlots.find(({ id }) => id === game.timeSlotIds[0]);
    const table = tables.find(({ id }) => id === game.tableId);
    this.announcer.announce(
      fr`Partie « ${scenario.title} » programmée : créneau ${slot?.rank}, ${table?.name}.`,
    );
    this.focusGame(game);
  }

  /** Ouvre la fiche de la partie, et y met le focus. */
  protected open(game: GameDto) {
    this.selectedId.set(game.id);
    afterNextRender(() => this.sheet()?.focus(), { injector: this.injector });
  }

  /** Ferme la fiche : le focus revient à la partie. */
  protected close(game: GameDto) {
    this.selectedId.set(null);
    this.focusGame(game);
  }

  /**
   * Ouvre le dialogue de placement de la partie. Une fois déplacée ou échangée, le focus va à sa
   * carte, à sa nouvelle place, et la région `aria-live` l'annonce. La fiche reste ouverte.
   */
  protected async move(game: GameDto) {
    const { timeSlots, tables } = this.convention();
    const outcome = await this.placements.moveTo({ game, timeSlots, tables });
    if (!outcome) return;
    const { schedule, swappedWith } = outcome;
    this.schedule.set(schedule);
    const moved = schedule.games.find(({ id }) => id === game.id);
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
    this.focusGame(moved);
  }

  /**
   * Déprogramme la partie, sans confirmation (docs/design/patterns.md, Actions destructrices). La
   * fiche se ferme, et le focus va à la réserve, où revient son scénario. Un refus s'affiche en
   * notification ; s'il dit le programme changé entre-temps, le programme se relit.
   */
  protected async unschedule(game: GameDto) {
    const outcome = await this.unscheduling.run(() =>
      this.apiCall(scheduleEndpoints.unschedule, { params: { gameId: game.id } }),
    );
    if (outcome.status === 'refused' && outcome.refusal.stale) this.schedule.reload();
    if (outcome.status !== 'done') return;
    this.schedule.set(outcome.value);
    this.selectedId.set(null);
    this.announcer.announce(fr`Partie « ${game.scenario.title} » déprogrammée.`);
    afterNextRender(() => document.getElementById('reserve-title')?.focus(), {
      injector: this.injector,
    });
  }

  private focusGame(game: GameDto) {
    afterNextRender(() => document.getElementById(`game-${game.id}`)?.focus(), {
      injector: this.injector,
    });
  }
}
