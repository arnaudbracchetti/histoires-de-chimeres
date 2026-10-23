import { Component, computed, inject } from '@angular/core';
import { timeSlotEndpoints, type TimeSlotDto } from '@chimeres/contract';
import { ConventionStore } from '../convention/convention-store';
import { availabilitiesConsequence } from '../game-masters/availabilities-consequence';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { Button } from '../ui/button';
import { AddCard, Card } from '../ui/card';
import { CardEditing } from '../ui/card-editing';
import { IconTile } from '../ui/icon-tile';
import { formatDuration, formatTimeRange } from './time-format';
import { TimeSlotEditor } from './time-slot-editor';

/**
 * Les créneaux de la journée, une carte par créneau, la pause entre deux (docs/design/patterns.md,
 * Créneaux). « Modifier » retourne la carte en saisie, et les autres s'estompent le temps de la
 * saisie. « Ajouter un créneau » ouvre une carte de saisie en bas ; après l'ajout, la suivante
 * s'ouvre aussitôt. Quitter la page pendant une saisie l'abandonne sans rien demander.
 */
@Component({
  selector: 'app-time-slot-list',
  imports: [AddCard, Button, Card, IconTile, Loadable, TimeSlotEditor],
  template: `
    <app-loadable [resource]="store.convention" failure="Impossible de charger les créneaux.">
      <ol class="day" aria-label="Créneaux de la journée">
        @for (row of rows(); track row.slot.id) {
          <li>
            @if (cards.editing() === row.slot.id) {
              <article appCard editing [cardId]="row.slot.id">
                <app-time-slot-editor
                  [timeSlot]="row.slot"
                  (saved)="cards.close(row.slot.id)"
                  (cancelled)="cards.close(row.slot.id)"
                />
              </article>
            } @else {
              <article
                appCard
                tabindex="-1"
                [cardId]="row.slot.id"
                [dimmed]="cards.isDimmed(row.slot.id)"
                [attr.aria-labelledby]="'time-slot-' + row.slot.id"
              >
                <div class="heading">
                  <app-icon-tile name="hourglass" />
                  <div>
                    <h3 [id]="'time-slot-' + row.slot.id">Créneau {{ row.slot.rank }}</h3>
                    <p class="range">{{ row.range }}</p>
                  </div>
                </div>
                <p class="duration">{{ row.duration }}</p>
                <div class="buttons">
                  <button
                    type="button"
                    appButton="secondary"
                    [attr.aria-label]="'Modifier le créneau ' + row.slot.rank"
                    (click)="cards.edit(row.slot.id)"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    appButton="quiet-danger"
                    [attr.aria-label]="'Supprimer le créneau ' + row.slot.rank"
                    (click)="remove(row.slot)"
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            }
            @if (row.pause) {
              <p class="pause">{{ row.pause }}</p>
            }
          </li>
        }
        <li>
          @for (key of cards.newKeys(); track key) {
            <article appCard editing>
              <app-time-slot-editor
                [proposedStart]="lastEnd()"
                (saved)="cards.openNew()"
                (cancelled)="cards.closeNew()"
              />
            </article>
          } @empty {
            <button
              appAddCard
              aria-label="Ajouter un créneau"
              [dimmed]="cards.isDimmed('new')"
              (click)="cards.openNew()"
            >
              Ajouter un créneau
            </button>
          }
        </li>
      </ol>
    </app-loadable>
  `,
  styles: `
    @layer components {
      .day {
        display: flex;
        flex-direction: column;
        max-width: 36rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .card {
        gap: var(--space-l);
        align-items: center;
        justify-content: space-between;
        min-height: 72px;
        padding: var(--space-m) var(--space-l);
      }

      .heading {
        display: flex;
        gap: var(--space-m);
        align-items: center;
      }

      h3 {
        font-size: var(--font-size-block);
      }

      .range,
      .duration {
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }

      .buttons {
        display: flex;
        gap: var(--space-s);
      }

      .pause {
        margin-left: var(--space-xl);
        padding: var(--space-xs) var(--space-l);
        border-left: 2px dotted var(--border);
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .add {
        width: 100%;
        min-height: 56px;
        margin-top: var(--space-m);
      }
    }
  `,
})
export class TimeSlotList {
  protected readonly store = inject(ConventionStore);
  private readonly announcer = inject(Announcer);
  protected readonly cards = new CardEditing();

  private readonly timeSlots = this.store.timeSlots;

  protected readonly rows = computed(() =>
    this.timeSlots().map((slot, index) => {
      const next = this.timeSlots()[index + 1];
      return {
        slot,
        range: formatTimeRange(slot.start, slot.end),
        duration: formatDuration(slot.start, slot.end),
        pause: !next
          ? ''
          : next.start === slot.end
            ? 'bout à bout'
            : `pause de ${formatDuration(slot.end, next.start)}`,
      };
    }),
  );

  /** Fin du dernier créneau : le début proposé pour le suivant. */
  protected readonly lastEnd = computed(() => this.timeSlots().at(-1)?.end ?? '');

  protected async remove(slot: TimeSlotDto) {
    const index = this.timeSlots().findIndex(({ id }) => id === slot.id);
    const removed = await this.cards.remove(index, {
      question: `Supprimer le créneau ${slot.rank} ?`,
      consequence: availabilitiesConsequence(slot.availabilityCount),
      confirmLabel: 'Supprimer le créneau',
      action: () => this.store.write(timeSlotEndpoints.remove, { params: { timeSlotId: slot.id } }),
      onStale: () => this.store.convention.reload(),
    });
    if (removed) this.announcer.announce(`Créneau ${slot.rank} supprimé.`);
  }
}
