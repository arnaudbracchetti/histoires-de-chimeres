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
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  scheduleEndpoints,
  type ReserveScenarioDto,
  type ScheduleDto,
  type ScheduleScenarioDto,
  type TableDto,
  type TimeSlotTrackingDto,
} from '@chimeres/contract';
import { fr } from '@chimeres/design';
import { injectApiCall } from '../api-call';
import { apiResource } from '../api-resource';
import { injectGesture } from '../gesture';
import { buildScheduleQuestion } from '../schedule/removed-sign-ups-confirmations';
import { RemovedSignUpsGestures } from '../schedule/removed-sign-ups-gestures';
import { Loadable } from '../shell/loadable';
import { Button } from '../ui/button';
import { TrackedReservePanel } from './tracked-reserve-panel';

/**
 * Programmer depuis la réserve d'un créneau en tirage : le créneau, la journée, qui donne le rang des
 * créneaux, la réserve et les tables, comme dans le suivi.
 */
export type ReserveSchedulingRequest = {
  timeSlot: TimeSlotTrackingDto;
  timeSlots: readonly TimeSlotTrackingDto[];
  reserve: readonly ReserveScenarioDto[];
  tables: readonly TableDto[];
};

type DialogData = ReserveSchedulingRequest & { titleId: string };

let nextId = 0;

/**
 * Dialogue de « Programmer depuis la réserve… » sur un créneau en tirage (docs/design/patterns.md,
 * Pilotage du jour J), en deux temps : la réserve du créneau, comme dans son onglet, puis, pour le
 * scénario choisi, une table libre, que les verdicts de programmation, lus dans l'API, donnent
 * (« Programmer sur Licorne »). Le front ne recalcule jamais PR-5. Si le verdict de la case dit le
 * tirage effacé (TI-6), une confirmation rouge précède l'écriture ; le dialogue se ferme ensuite sur
 * le programme relu. Un refus s'affiche dans le dialogue ouvert.
 */
@Component({
  selector: 'app-reserve-scheduling-dialog',
  imports: [Button, Loadable, TrackedReservePanel],
  host: { class: 'placement-dialog', '[attr.aria-busy]': 'gesture.running()' },
  template: `
    <h2 [id]="request.titleId">{{ title() }}</h2>
    @if (chosen(); as scenario) {
      <app-loadable [resource]="placements" failure="Impossible de lire les tables possibles.">
        @if (placements.hasValue()) {
          @if (freeTables().length) {
            <ul aria-label="Tables libres">
              @for (table of freeTables(); track table.id) {
                <li>
                  <button type="button" appButton="secondary" (click)="scheduleOn(scenario, table)">
                    Programmer sur {{ table.name }}
                  </button>
                </li>
              }
            </ul>
          } @else {
            <p class="quiet">Aucune table libre pour ce scénario sur ce créneau.</p>
          }
        }
      </app-loadable>
    } @else {
      <app-tracked-reserve-panel
        [timeSlot]="request.timeSlot"
        [timeSlots]="request.timeSlots"
        [reserve]="request.reserve"
        (scheduleOn)="choose($event)"
      />
    }
    <!-- Ligne réservée : un refus ne décale rien. -->
    <p role="alert" class="refusal">{{ refusal() }}</p>
    <div class="actions">
      @if (chosen()) {
        <button type="button" appButton="quiet" (click)="choose(null)">Retour à la réserve</button>
      }
      <button type="button" appButton="quiet" class="cancel" (click)="ref.close()">Annuler</button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        width: 48rem;
      }

      ul {
        display: flex;
        flex-wrap: wrap;
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
export class ReserveSchedulingDialog {
  protected readonly request = inject<DialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ScheduleDto>>(DialogRef);
  private readonly apiCall = injectApiCall();
  private readonly gestures = inject(RemovedSignUpsGestures);

  /** Le scénario choisi dans la réserve, ou `null` tant qu'on la parcourt. */
  protected readonly chosen = signal<ScheduleScenarioDto | null>(null);
  protected readonly title = computed(() => {
    const scenario = this.chosen();
    const rank = this.request.timeSlot.rank;
    return scenario
      ? fr`Programmer « ${scenario.title} » sur le créneau ${rank}`
      : fr`Programmer depuis la réserve du créneau ${rank}`;
  });
  protected readonly placements = apiResource(scheduleEndpoints.placements, () => {
    const scenario = this.chosen();
    return scenario ? { scenarioId: scenario.id } : undefined;
  });
  /** Les tables du créneau où le scénario se programme, dans l'ordre naturel. */
  protected readonly freeTables = computed(() => {
    const placements = this.placements.value() ?? [];
    return this.request.tables.filter((table) =>
      placements.some(
        ({ timeSlotId, tableId, refusal }) =>
          timeSlotId === this.request.timeSlot.id && tableId === table.id && !refusal,
      ),
    );
  });
  protected readonly gesture = injectGesture();
  protected readonly refusal = computed(() => this.gesture.refusal()?.message);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  constructor() {
    // Le focus suit l'étape : la première carte de la réserve, puis, une fois les verdicts lus, la
    // première table libre, ou « Annuler » à défaut.
    effect(() => {
      if (this.chosen() && !this.placements.hasValue()) return;
      afterNextRender(
        () => this.host.querySelector<HTMLElement>('li button:not(:disabled), .cancel')?.focus(),
        { injector: this.injector },
      );
    });
  }

  protected choose(scenario: ScheduleScenarioDto | null) {
    this.chosen.set(scenario);
  }

  /**
   * Programme le scénario sur la table : après la confirmation rouge de #116 si son verdict dit le
   * tirage du créneau effacé, aussitôt sinon. Un refus périmé relit les verdicts.
   */
  protected async scheduleOn(scenario: ScheduleScenarioDto, table: TableDto) {
    const { timeSlot } = this.request;
    const verdict = this.placements
      .value()
      ?.find(({ timeSlotId, tableId }) => timeSlotId === timeSlot.id && tableId === table.id);
    const erased = verdict?.erasedDrawTimeSlotId;
    const schedule = await this.gestures.writeConfirmingIfAny(
      () =>
        this.apiCall(scheduleEndpoints.schedule, {
          body: { scenarioId: scenario.id, timeSlotId: timeSlot.id, tableId: table.id },
        }),
      erased
        ? {
            question: buildScheduleQuestion(scenario, timeSlot.rank, table),
            consequences: [
              fr`Le tirage provisoire sera effacé, avec ses déplacements et ses parties annulées, et les inscriptions du créneau ${timeSlot.rank} rouvertes.`,
              fr`Tous ceux qui peuvent s'inscrire sur ce créneau reçoivent la notification « nouvelle partie », qui annonce la réouverture. Tu relanceras le tirage ensuite.`,
            ],
            confirmLabel: 'Programmer la partie',
          }
        : undefined,
      this.gesture,
      () => this.placements.reload(),
    );
    if (schedule) this.ref.close(schedule);
  }
}

/** Ouvre le dialogue. À sa fermeture, le focus revient à l'élément qui l'a ouvert. */
@Injectable({ providedIn: 'root' })
export class ReserveScheduling {
  private readonly dialog = inject(Dialog);

  /** Résout le programme relu après la programmation, ou `undefined` si le dialogue se ferme sans elle. */
  scheduleFromReserve(request: ReserveSchedulingRequest): Promise<ScheduleDto | undefined> {
    const titleId = `reserve-scheduling-${nextId++}`;
    const ref = this.dialog.open<ScheduleDto, unknown, ReserveSchedulingDialog>(
      ReserveSchedulingDialog,
      {
        data: { ...request, titleId },
        ariaLabelledBy: titleId,
        autoFocus: 'dialog',
        restoreFocus: true,
      },
    );
    return firstValueFrom(ref.closed);
  }
}
