import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  Component,
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
  type PlacementDto,
  type ScheduleDto,
  type ScheduleScenarioDto,
  type TableDto,
  type TimeSlotDto,
} from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { apiResource } from '../api-resource';
import { readProblem } from '../problem';
import { Loadable } from '../shell/loadable';
import { formatTimeRange, timeSlotLabel } from '../time-slots/time-format';
import { Button } from '../ui/button';

export type PlacementRequest = {
  scenario: ScheduleScenarioDto;
  /** Dans l'ordre de la journée. */
  timeSlots: readonly TimeSlotDto[];
  /** Dans l'ordre naturel. */
  tables: readonly TableDto[];
};

let nextId = 0;

/**
 * Dialogue de placement de « Programmer sur… » (docs/design/patterns.md, Programmation) : une
 * grille créneaux × tables, lue dans l'API à l'ouverture. Chaque case est « Choisir », ou éteinte
 * avec le motif de son verdict ; le front ne recalcule jamais PR-5. Choisir programme la partie et
 * ferme le dialogue sur le programme relu.
 */
@Component({
  selector: 'app-placement-dialog',
  imports: [Button, Loadable],
  host: { '[attr.aria-busy]': 'running()' },
  template: `
    <h2 [id]="request.titleId">Programmer « {{ request.scenario.title }} » sur…</h2>
    <app-loadable [resource]="placements" failure="Impossible de lire les cases possibles.">
      @if (placements.hasValue()) {
        <table>
          <caption class="visually-hidden">
            Cases du programme, par table et par créneau
          </caption>
          <thead>
            <tr>
              <td></td>
              @for (slot of request.timeSlots; track slot.id) {
                <th scope="col">
                  <span class="caps">Créneau {{ slot.rank }}</span
                  >{{ ' ' }}
                  <span class="range">{{ range(slot) }}</span>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (table of request.tables; track table.id) {
              <tr>
                <th scope="row" class="caps">{{ table.name }}</th>
                @for (slot of request.timeSlots; track slot.id) {
                  <td>
                    @if (verdictOf(slot.id, table.id); as verdict) {
                      @if (verdict.refusal; as refusal) {
                        <span class="off" [title]="refusal.detail">
                          {{ refusal.title }}
                          <span class="visually-hidden">{{ refusal.detail }}</span>
                        </span>
                      } @else {
                        <button
                          type="button"
                          appButton="secondary"
                          [attr.aria-label]="'Choisir ' + label(slot, table)"
                          (click)="choose(slot, table)"
                        >
                          Choisir
                        </button>
                      }
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
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
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        max-width: calc(100vw - 2 * var(--space-xl));
        max-height: calc(100vh - 2 * var(--space-xl));
        overflow: auto;
        padding: var(--space-l) var(--space-xl);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);
      }

      h2 {
        font-family: var(--font-ui);
        font-size: var(--font-size-block);
        font-weight: 600;
      }

      table {
        border-collapse: separate;
        border-spacing: var(--space-xs);
      }

      th {
        text-align: left;
      }

      thead th span {
        display: block;
      }

      .caps {
        font-family: var(--font-caps);
        font-weight: normal;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .range {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      td {
        min-width: 8rem;
        height: 2.5rem;
      }

      .off {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .refusal {
        min-height: 1lh;
        color: var(--danger);
      }

      .actions {
        display: flex;
        justify-content: flex-end;
      }
    }
  `,
})
export class PlacementDialog {
  protected readonly request = inject<PlacementRequest & { titleId: string }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ScheduleDto>>(DialogRef);
  private readonly apiCall = injectApiCall();

  protected readonly placements = apiResource(scheduleEndpoints.placements, () => ({
    scenarioId: this.request.scenario.id,
  }));
  protected readonly running = signal(false);
  protected readonly refusal = signal<string | undefined>(undefined);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  constructor() {
    // Le focus attend la grille : il va à la première case libre, ou à « Annuler » s'il n'y en a pas.
    effect(() => {
      if (!this.placements.hasValue()) return;
      afterNextRender(
        () =>
          this.host.querySelector<HTMLElement>('button[aria-label^="Choisir"], .cancel')?.focus(),
        { injector: this.injector },
      );
    });
  }

  protected verdictOf(timeSlotId: string, tableId: string): PlacementDto | undefined {
    return this.placements
      .value()
      ?.find((verdict) => verdict.timeSlotId === timeSlotId && verdict.tableId === tableId);
  }

  protected range({ start, end }: TimeSlotDto): string {
    return formatTimeRange(start, end);
  }

  protected label(slot: TimeSlotDto, table: TableDto): string {
    return `${timeSlotLabel(slot)}, ${table.name}`;
  }

  /** Un refus (le programme a changé entre-temps) s'affiche dans le dialogue, et la grille se relit. */
  protected async choose(slot: TimeSlotDto, table: TableDto) {
    if (this.running()) return;
    this.running.set(true);
    try {
      const schedule = await this.apiCall(scheduleEndpoints.schedule, {
        body: { scenarioId: this.request.scenario.id, timeSlotId: slot.id, tableId: table.id },
      });
      this.ref.close(schedule);
    } catch (error) {
      const { alert, fieldErrors } = readProblem(error);
      this.refusal.set(
        alert ? (alert.detail ?? alert.title) : fieldErrors.map(({ message }) => message).join(' '),
      );
      this.placements.reload();
    } finally {
      this.running.set(false);
    }
  }
}

/** Ouvre le dialogue de placement. À sa fermeture, le focus revient à l'élément qui l'a ouvert. */
@Injectable({ providedIn: 'root' })
export class Placements {
  private readonly dialog = inject(Dialog);

  /** Résout le programme relu après la programmation, ou `undefined` si le dialogue se ferme sans elle. */
  async scheduleOn(request: PlacementRequest): Promise<ScheduleDto | undefined> {
    const titleId = `placement-${nextId++}`;
    const ref = this.dialog.open<ScheduleDto, unknown, PlacementDialog>(PlacementDialog, {
      data: { ...request, titleId },
      ariaLabelledBy: titleId,
      autoFocus: 'dialog',
      restoreFocus: true,
    });
    return firstValueFrom(ref.closed);
  }
}
