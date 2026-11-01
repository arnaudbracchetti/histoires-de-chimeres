import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injectable,
  Injector,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  scheduleEndpoints,
  type CellPlacementDto,
  type ScheduleDto,
  type TableDto,
} from '@chimeres/contract';
import { formatCount, fr } from '@chimeres/design';
import { injectApiCall } from '../api-call';
import { apiResource } from '../api-resource';
import { injectGesture } from '../gesture';
import { Loadable } from '../shell/loadable';
import { Button } from '../ui/button';
import { ReserveScenarioCard } from '../ui/reserve-scenario-card';
import type { GridTimeSlot } from './grid-time-slot';

/** Programmer un scénario sur une case libre : un créneau et une table. */
export type CellPlacementRequest = { timeSlot: GridTimeSlot; table: TableDto };

type DialogData = CellPlacementRequest & { titleId: string };

let nextId = 0;

/**
 * Dialogue de « Programmer ici… » sur une table libre (docs/design/patterns.md, Pilotage du jour J) :
 * les verdicts de la case, lus dans l'API à l'ouverture, dans l'ordre reçu. D'abord les scénarios
 * programmables, avec « Choisir », puis « Pas programmables ici · N », chacun atténué avec son
 * motif ; le front ne recalcule jamais PR-5. Choisir programme la partie, et le dialogue se ferme
 * sur le programme relu. Un refus s'affiche comme dans le dialogue de placement.
 */
@Component({
  selector: 'app-cell-placement-dialog',
  imports: [Button, Loadable, ReserveScenarioCard],
  host: { class: 'placement-dialog', '[attr.aria-busy]': 'gesture.running()' },
  template: `
    <h2 [id]="request.titleId">{{ title }}</h2>
    <app-loadable [resource]="placements" failure="Impossible de lire les scénarios possibles.">
      @if (placements.hasValue()) {
        <section aria-label="Programmables ici">
          @if (schedulable().length) {
            <ul>
              @for (placement of schedulable(); track placement.scenario.id) {
                <li>
                  <app-reserve-scenario-card
                    [scenario]="placement.scenario"
                    [titleId]="titleIdOf(placement)"
                  >
                    <button
                      type="button"
                      appButton="secondary"
                      [attr.aria-describedby]="titleIdOf(placement)"
                      (click)="choose(placement)"
                    >
                      Choisir
                    </button>
                  </app-reserve-scenario-card>
                </li>
              }
            </ul>
          } @else {
            <p class="quiet">Aucun scénario programmable ici.</p>
          }
        </section>
        @if (others().length) {
          <section [attr.aria-labelledby]="request.titleId + '-others'">
            <h3 [id]="request.titleId + '-others'">
              Pas programmables ici · {{ formatCount(others().length) }}
            </h3>
            <ul>
              @for (placement of others(); track placement.scenario.id) {
                <li>
                  <app-reserve-scenario-card
                    [scenario]="placement.scenario"
                    [refusal]="placement.refusal"
                    [titleId]="titleIdOf(placement)"
                  />
                </li>
              }
            </ul>
          </section>
        }
      }
    </app-loadable>
    <!-- Ligne réservée : un refus ne décale rien. -->
    <p role="alert" class="refusal">{{ refusal() }}</p>
    <div class="actions">
      <button type="button" appButton="quiet" class="cancel" (click)="ref.close()">Annuler</button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        width: 32rem;
      }

      section {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
      }

      h3 {
        color: var(--text-muted);
        font-family: var(--font-ui);
        font-size: var(--font-size-meta);
        font-weight: 600;
      }

      ul {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .quiet {
        margin: 0;
        color: var(--text-muted);
      }
    }
  `,
})
export class CellPlacementDialog {
  protected readonly request = inject<DialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ScheduleDto>>(DialogRef);
  private readonly apiCall = injectApiCall();
  protected readonly formatCount = formatCount;

  protected readonly title = fr`Programmer sur le créneau ${this.request.timeSlot.rank}, table ${this.request.table.name}`;
  protected readonly placements = apiResource(scheduleEndpoints.cellPlacements, () => ({
    timeSlotId: this.request.timeSlot.id,
    tableId: this.request.table.id,
  }));
  /** Dans l'ordre reçu, les programmables d'abord. */
  protected readonly schedulable = computed(() =>
    (this.placements.value() ?? []).filter(({ refusal }) => !refusal),
  );
  protected readonly others = computed(() =>
    (this.placements.value() ?? []).filter(({ refusal }) => refusal),
  );
  protected readonly gesture = injectGesture();
  protected readonly refusal = computed(() => this.gesture.refusal()?.message);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  constructor() {
    // Le focus attend les verdicts : il va au premier « Choisir », ou à « Annuler » à défaut.
    effect(() => {
      if (!this.placements.hasValue()) return;
      afterNextRender(() => this.host.querySelector<HTMLElement>('li button, .cancel')?.focus(), {
        injector: this.injector,
      });
    });
  }

  protected titleIdOf({ scenario }: CellPlacementDto): string {
    return `${this.request.titleId}-${scenario.id}`;
  }

  /**
   * Un refus s'affiche dans le dialogue. S'il dit le programme changé entre-temps, les verdicts se
   * relisent ; après une coupure, ils restent tels quels, pour réessayer.
   */
  protected async choose({ scenario }: CellPlacementDto) {
    const { timeSlot, table } = this.request;
    const outcome = await this.gesture.run(() =>
      this.apiCall(scheduleEndpoints.schedule, {
        body: { scenarioId: scenario.id, timeSlotId: timeSlot.id, tableId: table.id },
      }),
    );
    if (outcome.status === 'done') this.ref.close(outcome.value);
    else if (outcome.status === 'refused' && outcome.refusal.stale) this.placements.reload();
  }
}

/** Ouvre le dialogue de « Programmer ici… ». À sa fermeture, le focus revient à l'élément qui l'a ouvert. */
@Injectable({ providedIn: 'root' })
export class CellPlacements {
  private readonly dialog = inject(Dialog);

  /** Résout le programme relu après la programmation, ou `undefined` si le dialogue se ferme sans elle. */
  scheduleOn(request: CellPlacementRequest): Promise<ScheduleDto | undefined> {
    const titleId = `cell-placement-${nextId++}`;
    const ref = this.dialog.open<ScheduleDto, unknown, CellPlacementDialog>(CellPlacementDialog, {
      data: { ...request, titleId },
      ariaLabelledBy: titleId,
      autoFocus: 'dialog',
      restoreFocus: true,
    });
    return firstValueFrom(ref.closed);
  }
}
