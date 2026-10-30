import { Location } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  type ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { GameCard } from '../game/game-card';
import { ParticipantData } from '../participant-data/participant-data';
import { formatTime, formatTimeRange } from '@chimeres/design';

/** Paramètre de l'adresse du programme : le rang du créneau montré (`/programme?creneau=2`). */
const TIME_SLOT_PARAM = 'creneau';

/**
 * Le programme des parties, créneau par créneau : une puce par créneau à venir, puis les parties du
 * créneau choisi, en cartes. Une partie double est sous son seul premier créneau (IN-3).
 */
@Component({
  selector: 'app-schedule-page',
  imports: [GameCard],
  template: `
    <h1 class="visually-hidden">Programme</h1>
    @if (data.schedule(); as schedule) {
      @if (selected(); as slot) {
        <nav #chips aria-label="Créneaux">
          @for (chip of schedule.timeSlots; track chip.id) {
            <a
              [href]="'/programme?' + param + '=' + chip.rank"
              [attr.aria-current]="chip.id === slot.id ? 'true' : null"
              (click)="$event.preventDefault(); select(chip.rank)"
            >
              <span class="over">Créneau {{ chip.rank }}</span>
              <span class="time">{{ start(chip.start) }}</span>
            </a>
          }
        </nav>
        <p class="range">{{ range(slot.start, slot.end) }}</p>
        <ul>
          @for (game of games(); track game.id) {
            <li><app-game-card [game]="game" [schedule]="schedule" /></li>
          } @empty {
            <li class="empty">Aucune partie sur ce créneau pour l'instant.</li>
          }
        </ul>
      } @else {
        <p class="empty">Le programme n'est pas encore prêt. Reviens un peu plus tard.</p>
      }
    } @else {
      <p>Chargement…</p>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: grid;
        gap: var(--space-m);
      }

      /* Collée sous l'en-tête, de bord à bord. Trop de créneaux pour la largeur : elle glisse. */
      nav {
        position: sticky;
        top: var(--bar-height);
        z-index: 1;
        display: flex;
        gap: var(--space-xs);
        margin: calc(-1 * var(--gutter)) calc(-1 * var(--gutter)) 0;
        padding: var(--space-s) var(--gutter);
        overflow-x: auto;
        border-bottom: 1px solid var(--border);
        background: var(--surface-1);
        scroll-padding-inline: var(--gutter);
        scroll-snap-type: x proximity;
        scrollbar-width: none;
      }

      nav a {
        display: grid;
        flex: 1 0 0;
        justify-items: center;
        align-content: center;
        min-width: max-content;
        min-height: var(--button-height);
        padding: var(--space-xs);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-2);
        color: var(--text);
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
        text-decoration: none;
        white-space: nowrap;
        scroll-snap-align: start;

        &[aria-current='true'] {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 12%, var(--surface-2));
          color: var(--accent);
        }
      }

      /* Le surtitre d'une puce prend sa couleur : orange sur le créneau choisi. */
      .over {
        color: inherit;
      }

      .time,
      .range {
        font-variant-numeric: tabular-nums;
      }

      .range {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }

      ul {
        display: grid;
        gap: var(--space-l);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .empty {
        color: var(--text-muted);
        text-align: center;
      }
    }
  `,
})
export class SchedulePage {
  protected readonly data = inject(ParticipantData);
  protected readonly param = TIME_SLOT_PARAM;
  protected readonly start = formatTime;
  protected readonly range = formatTimeRange;

  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly rank = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => Number(params.get(TIME_SLOT_PARAM)))),
  );

  /** Le créneau de l'adresse, ou à défaut le premier à venir. */
  protected readonly selected = computed(() => {
    const slots = this.data.schedule()?.timeSlots ?? [];
    return slots.find(({ rank }) => rank === this.rank()) ?? slots[0];
  });

  protected readonly games = computed(() => {
    const slot = this.selected();
    return (this.data.schedule()?.games ?? []).filter(
      (game) => slot && game.timeSlotIds[0] === slot.id,
    );
  });

  /** Le créneau choisi reste visible dans la barre, même s'il était hors de l'écran. */
  private readonly chips = viewChild<ElementRef<HTMLElement>>('chips');

  constructor() {
    afterRenderEffect(() => {
      this.selected();
      this.chips()
        ?.nativeElement.querySelector('[aria-current="true"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  /** Changer de créneau ne s'empile pas dans l'historique : le retour remonte d'un écran. */
  protected select(rank: number): void {
    void this.router.navigate([], {
      queryParams: { [TIME_SLOT_PARAM]: rank },
      replaceUrl: true,
      state: this.location.getState() as Record<string, unknown>,
    });
  }
}
