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
  type GameDto,
  type MovePlacementDto,
  type PlacementDto,
  type ScheduleDto,
  type ScheduleScenarioDto,
  type TableDto,
  type TimeSlotDto,
} from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { apiResource } from '../api-resource';
import { injectGesture, type GestureOutcome } from '../gesture';
import { Loadable } from '../shell/loadable';
import { formatTimeRange, fr, timeSlotLabel } from '@chimeres/design';
import { Button } from '../ui/button';

/** La grille du programme : ses créneaux, dans l'ordre de la journée, et ses tables, dans l'ordre naturel. */
type Grid = {
  timeSlots: readonly TimeSlotDto[];
  tables: readonly TableDto[];
};

/** Programmer un scénario de la réserve. */
export type PlacementRequest = Grid & { scenario: ScheduleScenarioDto };

/** Déplacer une partie : sa case, celle de son premier créneau, n'offre pas « Choisir ». */
export type MoveRequest = Grid & { game: GameDto };

/**
 * Le programme relu après le geste, et l'id de la partie échangée avec celle qu'on déplace, ou
 * `null`.
 */
export type Placed = { schedule: ScheduleDto; swappedWith: string | null };

/** Le verdict d'une case : un déplacement propose aussi d'échanger avec une autre partie. */
type Verdict = PlacementDto & Partial<Pick<MovePlacementDto, 'swapWith'>>;

type DialogData = (PlacementRequest | MoveRequest) & { titleId: string };

let nextId = 0;

/**
 * Dialogue de placement de « Programmer sur… » et de « Déplacer vers… » (docs/design/patterns.md,
 * Programmation) : une grille créneaux × tables, lue dans l'API à l'ouverture. Chaque case est
 * « Choisir », « Échanger » sur la première case d'une autre partie, ou éteinte avec le motif de
 * son verdict ; le front ne recalcule jamais PR-5. Choisir programme ou déplace la partie, Échanger
 * échange les deux parties, et le dialogue se ferme sur le programme relu.
 */
@Component({
  selector: 'app-placement-dialog',
  imports: [Button, Loadable],
  host: { '[attr.aria-busy]': 'gesture.running()' },
  template: `
    <h2 [id]="request.titleId">{{ title }}</h2>
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
                      @if (isCurrent(slot, table)) {
                        <span class="off">Sa place</span>
                      } @else if (verdict.refusal; as refusal) {
                        <span class="off" [title]="refusal.detail">
                          {{ refusal.title }}
                          <span class="visually-hidden">{{ refusal.detail }}</span>
                        </span>
                      } @else if (verdict.swapWith; as other) {
                        <button
                          type="button"
                          appButton="secondary"
                          [attr.aria-label]="'Échanger ' + label(slot, table)"
                          (click)="swap(other)"
                        >
                          Échanger
                        </button>
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
  protected readonly request = inject<DialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Placed>>(DialogRef);
  private readonly apiCall = injectApiCall();

  protected readonly title =
    'game' in this.request
      ? fr`Déplacer « ${this.request.game.scenario.title} » vers…`
      : fr`Programmer « ${this.request.scenario.title} » sur…`;
  protected readonly placements = placementsOf(this.request);
  protected readonly gesture = injectGesture();
  protected readonly refusal = computed(() => this.gesture.refusal()?.message);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  constructor() {
    // Le focus attend la grille : il va à la première case possible, ou à « Annuler » à défaut.
    effect(() => {
      if (!this.placements.hasValue()) return;
      afterNextRender(() => this.host.querySelector<HTMLElement>('td button, .cancel')?.focus(), {
        injector: this.injector,
      });
    });
  }

  protected verdictOf(timeSlotId: string, tableId: string): Verdict | undefined {
    const placements: readonly Verdict[] | undefined = this.placements.value();
    return placements?.find(
      (verdict) => verdict.timeSlotId === timeSlotId && verdict.tableId === tableId,
    );
  }

  protected range({ start, end }: TimeSlotDto): string {
    return formatTimeRange(start, end);
  }

  protected label(slot: TimeSlotDto, table: TableDto): string {
    return `${timeSlotLabel(slot)}, ${table.name}`;
  }

  protected isCurrent(slot: TimeSlotDto, table: TableDto): boolean {
    if (!('game' in this.request)) return false;
    const { game } = this.request;
    return game.timeSlotIds[0] === slot.id && game.tableId === table.id;
  }

  /**
   * Un refus s'affiche dans le dialogue. S'il dit le programme changé entre-temps, la grille se
   * relit ; après une coupure, elle reste telle quelle, pour réessayer.
   */
  protected async choose(slot: TimeSlotDto, table: TableDto) {
    const place = { timeSlotId: slot.id, tableId: table.id };
    const request = this.request;
    const outcome = await this.gesture.run(() =>
      'game' in request
        ? this.apiCall(scheduleEndpoints.move, { params: { gameId: request.game.id }, body: place })
        : this.apiCall(scheduleEndpoints.schedule, {
            body: { scenarioId: request.scenario.id, ...place },
          }),
    );
    this.conclude(outcome, null);
  }

  /** Échange la partie avec celle de la case ; un refus s'affiche comme pour « Choisir ». */
  protected async swap(otherGameId: string) {
    if (!('game' in this.request)) return;
    const gameId = this.request.game.id;
    const outcome = await this.gesture.run(() =>
      this.apiCall(scheduleEndpoints.swap, { params: { gameId }, body: { otherGameId } }),
    );
    this.conclude(outcome, otherGameId);
  }

  private conclude(outcome: GestureOutcome<ScheduleDto>, swappedWith: string | null) {
    if (outcome.status === 'done') this.ref.close({ schedule: outcome.value, swappedWith });
    else if (outcome.status === 'refused' && outcome.refusal.stale) this.placements.reload();
  }
}

/** Les verdicts de programmation du scénario, ou de déplacement de la partie. */
function placementsOf(request: PlacementRequest | MoveRequest) {
  if ('game' in request) {
    const gameId = request.game.id;
    return apiResource(scheduleEndpoints.movePlacements, () => ({ gameId }));
  }
  const scenarioId = request.scenario.id;
  return apiResource(scheduleEndpoints.placements, () => ({ scenarioId }));
}

/** Ouvre le dialogue de placement. À sa fermeture, le focus revient à l'élément qui l'a ouvert. */
@Injectable({ providedIn: 'root' })
export class Placements {
  private readonly dialog = inject(Dialog);

  /** Résout le programme relu après la programmation, ou `undefined` si le dialogue se ferme sans elle. */
  async scheduleOn(request: PlacementRequest): Promise<ScheduleDto | undefined> {
    return (await this.open(request))?.schedule;
  }

  /**
   * Résout le programme relu après le déplacement ou l'échange, ou `undefined` si le dialogue se
   * ferme sans eux.
   */
  moveTo(request: MoveRequest): Promise<Placed | undefined> {
    return this.open(request);
  }

  private async open(request: PlacementRequest | MoveRequest): Promise<Placed | undefined> {
    const titleId = `placement-${nextId++}`;
    const ref = this.dialog.open<Placed, unknown, PlacementDialog>(PlacementDialog, {
      data: { ...request, titleId },
      ariaLabelledBy: titleId,
      autoFocus: 'dialog',
      restoreFocus: true,
    });
    return firstValueFrom(ref.closed);
  }
}
