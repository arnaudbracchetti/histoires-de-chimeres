import { Component, computed, inject, input, output } from '@angular/core';
import { availabilityEndpoints, type GameMasterDto, type TimeSlotDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { injectGesture } from '../gesture';
import { Announcer } from '../shell/announcer';
import { formatTime, minutesOf, timeSlotLabel } from '../time-slots/time-format';
import { Icon } from '../ui/icon';

/** Un morceau de la journée, en minutes : un créneau, ou une pause sans `slot`. */
type Segment = { start: number; end: number; slot?: TimeSlotDto };

// Typographie de docs/design/ton.md : « 14 h », et la plage « 9 h 00 – 12 h 30 ».
const NBSP = '\u00a0';
const THIN_NBSP = '\u202f';

/**
 * Les disponibilités d'un MJ (docs/design/patterns.md, Disponibilités) : la journée en frise, à
 * l'échelle ; chaque créneau est un bloc à sa place et à sa durée, qui porte une case à cocher.
 * Un créneau court garde une largeur lisible, prise sur les pauses. Un clic sur le bloc enregistre aussitôt. Pendant l'écriture, le bloc
 * prend son nouvel état, atténué ; refusé, il revient à son état, le refus s'affiche en
 * notification, et `refused` demande de relire l'écran (Erreur hors formulaire). Le texte d'un
 * bloc suit sa largeur : plus petit, sur plusieurs lignes, puis réduit au rang et à l'icône.
 *
 * La grille a une colonne par segment de la journée, créneau ou pause, large de sa durée en `fr` ;
 * une heure pleine se place dans son segment, à proportion.
 */
@Component({
  selector: 'app-availability-timeline',
  imports: [Icon],
  template: `
    <div class="quick">
      <button type="button" class="link" (click)="setAll(true)">Toute la journée</button>
      <button type="button" class="link" (click)="setAll(false)">Aucun créneau</button>
    </div>
    <div class="scroller">
      <div class="day" [style.grid-template-columns]="columns()">
        @for (hour of hours(); track hour.label) {
          <span
            class="hour"
            [style.grid-column]="hour.column"
            [style.left.%]="hour.left"
            aria-hidden="true"
            >{{ hour.label }}</span
          >
        }
        @for (block of blocks(); track block.slot.id) {
          <label
            class="block"
            [class.on]="isChecked(block.slot.id)"
            [class.pending]="writes.isRunning(block.slot.id)"
            [style.grid-column]="block.column"
          >
            <input
              type="checkbox"
              class="visually-hidden"
              [attr.aria-label]="block.label"
              [checked]="isChecked(block.slot.id)"
              (change)="onChange(block.slot, $any($event.target))"
            />
            <span class="content">
              <span class="rank"><span class="word">Créneau </span>{{ block.slot.rank }}</span>
              <span class="range"
                ><span>{{ block.start }}</span
                ><wbr /><span>{{ block.end }}</span></span
              >
              <span class="state">
                @if (isChecked(block.slot.id)) {
                  <app-icon name="circle-check" />
                }
                <span class="state-text">{{
                  isChecked(block.slot.id) ? 'Je peux mener une partie' : 'Pas disponible'
                }}</span>
              </span>
            </span>
          </label>
        }
      </div>
    </div>
    <p class="hint">Clique sur un créneau pour dire si tu peux y mener une partie.</p>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        max-width: 64rem;
      }

      .quick {
        display: flex;
        gap: var(--space-l);
      }

      .link {
        padding: 0;
        border: 0;
        background: none;
        color: var(--accent);
        font: inherit;
        cursor: pointer;

        &:hover {
          text-decoration: underline;
        }
      }

      /* Une journée longue garde des blocs lisibles : elle défile plutôt que de les écraser. */
      .scroller {
        overflow-x: auto;
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-1);
      }

      /* Largeur minimale d'un créneau : « 18 h 00 – » tient en 11 px. */
      .day {
        --slot-min: 4.5rem;

        display: grid;
        grid-template-rows: auto auto;
        row-gap: var(--space-s);
        min-width: min-content;
        padding: var(--space-m) var(--space-xl) var(--space-l);
      }

      /* Sa position dans le segment, en % de la largeur du segment. */
      .hour {
        position: relative;
        grid-row: 1;
        justify-self: start;
        color: var(--text-muted);
        font-size: var(--font-size-overline);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        transform: translateX(-50%);
      }

      .block {
        container-type: inline-size;
        grid-row: 2;
        min-height: 5.5rem;
        margin-inline: 1px;
        border: 1px dashed var(--engraving-strong);
        border-radius: var(--radius-control);
        background: var(--surface-2);
        color: var(--text-muted);
        cursor: pointer;
        transition:
          background 150ms,
          border-color 150ms,
          opacity 150ms;

        &:hover {
          border-color: var(--accent);
        }

        &:has(input:focus-visible) {
          outline: 2px solid var(--focus);
          outline-offset: 2px;
        }

        &.on {
          border: 1px solid var(--accent);
          background: color-mix(in srgb, var(--accent) 22%, var(--surface-2));
          color: var(--text);
        }

        &.pending {
          opacity: 0.45;
        }
      }

      /* La taille du texte suit la largeur du bloc, entre 11 et 13 px. */
      .content {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding: var(--space-s);
        font-size: clamp(var(--font-size-overline), 8cqi, var(--font-size-body));
        line-height: 1.3;
      }

      .rank {
        font-family: var(--font-caps);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      /* Début et fin restent entiers : la plage ne se coupe qu'entre les deux. */
      .range {
        font-variant-numeric: tabular-nums;

        span {
          white-space: nowrap;
        }
      }

      .state {
        display: flex;
        gap: var(--space-xs);
        align-items: flex-start;
        margin-top: var(--space-xxs);
      }

      .on .state {
        color: var(--accent);
        font-weight: 600;
      }

      app-icon {
        margin-top: 0.1em;
      }

      /* Bloc étroit : le rang seul. */
      @container (width < 7rem) {
        .word {
          display: none;
        }
      }

      /* Bloc très étroit : l'icône seule dit l'état, le nom de la case le dit en entier. */
      @container (width < 6rem) {
        .content {
          padding: var(--space-xs);
        }

        .state-text {
          display: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .block {
          transition: none;
        }
      }

      .hint {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class AvailabilityTimeline {
  readonly gameMaster = input.required<GameMasterDto>();
  /** Les créneaux de la journée, dans l'ordre ; au moins un. */
  readonly timeSlots = input.required<readonly TimeSlotDto[]>();
  /** Une disponibilité est enregistrée : la fiche relue du MJ. */
  readonly changed = output<GameMasterDto>();
  /** Une écriture est refusée (404, 409, 422) : le bloc est revenu à son état, l'écran est à relire. */
  readonly refused = output<void>();

  /** Une écriture à la fois par créneau ; un refus part en notification. */
  protected readonly writes = injectGesture({ notify: true });

  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);

  /**
   * La journée en segments, de l'heure pleine avant le premier créneau à l'heure pleine après le
   * dernier : chaque créneau, et chaque pause qui les sépare.
   */
  private readonly segments = computed(() => {
    const slots = this.timeSlots();
    const segments: Segment[] = [];
    let cursor = Math.floor(minutesOf(slots[0]!.start) / 60) * 60;
    for (const slot of slots) {
      const start = minutesOf(slot.start);
      if (start > cursor) segments.push({ start: cursor, end: start });
      cursor = minutesOf(slot.end);
      segments.push({ start, end: cursor, slot });
    }
    const end = Math.ceil(cursor / 60) * 60;
    if (end > cursor) segments.push({ start: cursor, end });
    return segments;
  });

  /** Chaque segment large de sa durée ; un créneau, jamais moins que `--slot-min`. */
  protected readonly columns = computed(() =>
    this.segments()
      .map(({ start, end, slot }) =>
        slot ? `minmax(var(--slot-min), ${end - start}fr)` : `minmax(0, ${end - start}fr)`,
      )
      .join(' '),
  );

  /** Les heures pleines, chacune dans son segment ; la dernière au bord droit du dernier. */
  protected readonly hours = computed(() => {
    const segments = this.segments();
    const from = segments[0]!.start;
    const to = segments.at(-1)!.end;
    const hours = [];
    for (let minute = from; minute <= to; minute += 60) {
      const index = Math.max(
        0,
        segments.findIndex(({ start, end }) => start <= minute && minute < end),
      );
      const segment = minute === to ? segments.at(-1)! : segments[index]!;
      const column = minute === to ? segments.length : index + 1;
      hours.push({
        label: `${minute / 60}${NBSP}h`,
        column: `${column} / ${column + 1}`,
        left: ((minute - segment.start) / (segment.end - segment.start)) * 100,
      });
    }
    return hours;
  });

  protected readonly blocks = computed(() =>
    this.segments().flatMap(({ slot }, index) =>
      slot
        ? [
            {
              slot,
              label: timeSlotLabel(slot),
              start: `${formatTime(slot.start)}${THIN_NBSP}–`,
              end: `${THIN_NBSP}${formatTime(slot.end)}`,
              column: `${index + 1} / ${index + 2}`,
            },
          ]
        : [],
    ),
  );

  /** Pendant son écriture, un bloc montre l'état demandé : chaque écriture inverse l'état enregistré. */
  protected isChecked(timeSlotId: string): boolean {
    const saved = this.gameMaster().availabilities.includes(timeSlotId);
    return this.writes.isRunning(timeSlotId) ? !saved : saved;
  }

  protected onChange(slot: TimeSlotDto, box: HTMLInputElement): void {
    // Une seule écriture à la fois par créneau : un second clic pendant l'écriture est sans effet.
    if (this.writes.isRunning(slot.id)) {
      box.checked = this.isChecked(slot.id);
      return;
    }
    void this.write(slot, box.checked);
  }

  /** Tous les créneaux d'un geste, un par un : les écritures simultanées se gêneraient. */
  protected async setAll(available: boolean): Promise<void> {
    const slots = this.timeSlots().filter(
      ({ id }) => this.isChecked(id) !== available && !this.writes.isRunning(id),
    );
    for (const slot of slots) {
      if (!(await this.write(slot, available))) return;
    }
  }

  /** Enregistre un créneau ; `false` si l'écriture est refusée. */
  private async write(slot: TimeSlotDto, available: boolean): Promise<boolean> {
    const params = { gameMasterId: this.gameMaster().id, timeSlotId: slot.id };
    const endpoint = available ? availabilityEndpoints.declare : availabilityEndpoints.withdraw;
    const outcome = await this.writes.run(() => this.apiCall(endpoint, { params }), slot.id);
    if (outcome.status === 'done') {
      this.changed.emit(outcome.value);
      this.announcer.announce(
        `${available ? 'Disponible' : 'Plus disponible'} sur le créneau ${slot.rank}.`,
      );
      return true;
    }
    if (outcome.status === 'refused' && outcome.refusal.stale) this.refused.emit();
    return false;
  }
}
