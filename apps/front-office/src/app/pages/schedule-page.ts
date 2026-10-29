import { Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
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
 * créneau choisi, en cartes. Une partie double est sous ses deux créneaux (IN-3).
 */
@Component({
  selector: 'app-schedule-page',
  imports: [GameCard],
  template: `
    <h1 class="visually-hidden">Programme</h1>
    @if (data.schedule(); as schedule) {
      @if (selected(); as slot) {
        <nav aria-label="Créneaux">
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

      nav {
        display: grid;
        grid-auto-columns: 1fr;
        grid-auto-flow: column;
        gap: var(--space-xs);
      }

      nav a {
        display: grid;
        justify-items: center;
        align-content: center;
        min-height: var(--button-height);
        padding: var(--space-xs);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-2);
        color: var(--text);
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
        text-decoration: none;

        &[aria-current='true'] {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 12%, var(--surface-2));
          color: var(--accent);
        }
      }

      .over {
        font-family: var(--font-caps);
        font-size: var(--font-size-mobile-overline);
        font-weight: normal;
        letter-spacing: 0.12em;
        text-transform: uppercase;
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
      (game) => slot && game.timeSlotIds.includes(slot.id),
    );
  });

  /** Changer de créneau ne s'empile pas dans l'historique : le retour remonte d'un écran. */
  protected select(rank: number): void {
    void this.router.navigate([], {
      queryParams: { [TIME_SLOT_PARAM]: rank },
      replaceUrl: true,
      state: this.location.getState() as Record<string, unknown>,
    });
  }
}
