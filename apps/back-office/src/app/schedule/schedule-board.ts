import { afterNextRender, Component, inject, Injector, input } from '@angular/core';
import {
  scheduleEndpoints,
  type ConventionDto,
  type ScheduleScenarioDto,
} from '@chimeres/contract';
import { apiResource } from '../api-resource';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { Placements } from './placement-dialog';
import { ReserveTray } from './reserve-tray';
import { ScheduleTimeline } from './schedule-timeline';

/**
 * La frise du programme, et le bac de réserve dessous (docs/design/patterns.md, Programmation).
 * La page ne l'affiche qu'avec des créneaux et des tables : le programme se lit à ce moment-là.
 */
@Component({
  selector: 'app-schedule-board',
  imports: [Loadable, ReserveTray, ScheduleTimeline],
  template: `
    <app-loadable [resource]="schedule" failure="Impossible de charger le programme.">
      @if (schedule.hasValue()) {
        <app-schedule-timeline
          [timeSlots]="convention().timeSlots"
          [tables]="convention().tables"
          [games]="schedule.value().games"
        />
        <section aria-labelledby="reserve-title">
          <h2 id="reserve-title">Réserve</h2>
          <app-reserve-tray
            [timeSlots]="convention().timeSlots"
            [reserve]="schedule.value().reserve"
            [scenarios]="schedule.value().scenarios"
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
  private readonly placements = inject(Placements);
  private readonly announcer = inject(Announcer);
  private readonly injector = inject(Injector);

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
      `Partie « ${scenario.title} » programmée : créneau ${slot?.rank}, ${table?.name}.`,
    );
    afterNextRender(() => document.getElementById(`game-${game.id}`)?.focus(), {
      injector: this.injector,
    });
  }
}
