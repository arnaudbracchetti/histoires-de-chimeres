import { Component, input } from '@angular/core';
import type { TrackedGameDto } from '@chimeres/contract';
import { countOf, formatCount, formatSeats } from '@chimeres/design';
import { Gauge } from './gauge';

/**
 * Les inscrits d'une partie face à ses places (docs/design/patterns.md, Jauge) : sa jauge, puis
 * « 15 inscrits · 3 à 4 places », suivi de son écart, d'après les chiffres et les drapeaux reçus.
 * Au-delà du maximum, l'écart se compte (« · 11 de trop », pilotage), ou se dit (« · très
 * demandée », fiche d'un pseudo) ; sous le minimum, « · 1 manquant », en jaune.
 */
@Component({
  selector: 'app-game-sign-up-figures',
  imports: [Gauge],
  template: `
    <app-gauge
      [count]="game().signUpCount"
      [min]="game().seats.min"
      [max]="game().seats.max"
      [shortfall]="game().belowMinimum"
    />
    <span
      >{{ countOf(game().signUpCount, 'inscrit', 'inscrits') }} ·
      {{ formatSeats(game().seats) }}
      @if (excess() === 'count' && game().surplusSignUpCount) {
        · <strong>{{ formatCount(game().surplusSignUpCount) }}&nbsp;de trop</strong>
      } @else if (excess() === 'label' && game().oversubscribed) {
        · <strong>très demandée</strong>
      }
      @if (game().missingSignUpCount) {
        ·
        <strong class="missing">{{
          countOf(game().missingSignUpCount, 'manquant', 'manquants')
        }}</strong>
      }
    </span>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        align-items: flex-start;
        min-width: 0;
      }

      app-gauge {
        align-self: stretch;
        margin-bottom: var(--space-xxs);
      }

      strong {
        font-weight: 600;
      }

      .missing {
        color: var(--warning);
      }
    }
  `,
})
export class GameSignUpFigures {
  readonly game = input.required<TrackedGameDto>();
  /** L'écart au-delà du maximum : compté (`count`), ou dit « très demandée » (`label`). */
  readonly excess = input<'count' | 'label'>('count');

  protected readonly countOf = countOf;
  protected readonly formatCount = formatCount;
  protected readonly formatSeats = formatSeats;
}
