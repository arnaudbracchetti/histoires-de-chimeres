import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { timeSlotEndpoints, type TimeSlotDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { ConventionStore } from '../convention/convention-store';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { Button } from '../ui/button';
import { Confirmation } from '../ui/confirmation';
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
  imports: [Button, IconTile, Loadable, TimeSlotEditor],
  template: `
    <app-loadable [resource]="store.convention" failure="Impossible de charger les créneaux.">
      <ol class="day" [class.busy]="editing()" aria-label="Créneaux de la journée">
        @for (row of rows(); track row.slot.id) {
          <li>
            @if (editing() === row.slot.id) {
              <article
                appTimeSlotEditor
                class="card editing"
                [timeSlot]="row.slot"
                (saved)="closeEditor(row.slot.id)"
                (cancelled)="closeEditor(row.slot.id)"
              ></article>
            } @else {
              <article
                class="card"
                tabindex="-1"
                [attr.data-time-slot]="row.slot.id"
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
                    (click)="edit(row.slot)"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    appButton="quiet"
                    class="destructive"
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
          @for (key of newKeys(); track key) {
            <article
              appTimeSlotEditor
              class="card editing"
              [proposedStart]="lastEnd()"
              (saved)="openNew()"
              (cancelled)="closeNew()"
            ></article>
          } @empty {
            <button type="button" class="add" aria-label="Ajouter un créneau" (click)="openNew()">
              <span aria-hidden="true">+</span> Ajouter un créneau
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
        display: flex;
        gap: var(--space-l);
        align-items: center;
        justify-content: space-between;
        min-height: 72px;
        padding: var(--space-m) var(--space-l);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-1);
        transition: opacity 150ms;

        &.editing {
          flex-direction: column;
          gap: var(--space-s);
          align-items: stretch;
          border-color: var(--accent);
          box-shadow: var(--halo);
        }
      }

      /* Pendant une saisie, les autres cartes s'estompent : on voit où l'on en est. */
      .busy .card:not(.editing),
      .busy .add {
        opacity: 0.45;
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

      .destructive {
        color: var(--danger);
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
        border: 1px dashed var(--border);
        border-radius: var(--radius-card);
        background: none;
        color: var(--text-muted);
        cursor: pointer;

        &:hover {
          border-color: var(--accent);
          color: var(--text);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .card {
          transition: none;
        }
      }
    }
  `,
})
export class TimeSlotList {
  protected readonly store = inject(ConventionStore);
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly confirmation = inject(Confirmation);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** La carte en saisie : l'identifiant d'un créneau, `new` pour un ajout, ou rien. */
  protected readonly editing = computed(() => (this.newKeys().length ? 'new' : this.editedId()));
  private readonly editedId = signal<string | undefined>(undefined);
  /** La carte d'ajout : une clé neuve à chaque carte ouverte, ou aucune. */
  protected readonly newKeys = signal<number[]>([]);
  private nextKey = 0;

  private readonly timeSlots = computed(() =>
    this.store.convention.hasValue() ? this.store.convention.value().timeSlots : [],
  );

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

  protected openNew() {
    this.editedId.set(undefined);
    this.newKeys.set([this.nextKey++]);
  }

  protected closeNew() {
    this.newKeys.set([]);
    this.focusAfterRender(() => this.host.querySelector('.add'));
  }

  protected edit(slot: TimeSlotDto) {
    this.newKeys.set([]);
    this.editedId.set(slot.id);
  }

  protected closeEditor(timeSlotId: string) {
    this.editedId.set(undefined);
    this.focusAfterRender(() => this.cardOf(timeSlotId));
  }

  protected async remove(slot: TimeSlotDto) {
    const index = this.timeSlots().findIndex(({ id }) => id === slot.id);
    const removed = await this.confirmation.ask({
      question: `Supprimer le créneau ${slot.rank} ?`,
      confirmLabel: 'Supprimer le créneau',
      action: async () => {
        const convention = await this.apiCall(timeSlotEndpoints.remove, {
          params: { timeSlotId: slot.id },
        });
        this.store.convention.set(convention);
      },
    });
    if (!removed) return;
    this.announcer.announce(`Créneau ${slot.rank} supprimé.`);
    // Le focus va à la carte suivante, à défaut à la précédente, à défaut à « Ajouter un créneau ».
    this.focusAfterRender(() => {
      const cards = this.host.querySelectorAll<HTMLElement>('article.card');
      return cards[index] ?? cards[index - 1] ?? this.host.querySelector('.add');
    });
  }

  private cardOf(timeSlotId: string): HTMLElement | null {
    return this.host.querySelector(`article[data-time-slot="${timeSlotId}"]`);
  }

  private focusAfterRender(target: () => Element | null) {
    afterNextRender(() => (target() as HTMLElement | null)?.focus(), {
      injector: this.injector,
    });
  }
}
