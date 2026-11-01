import { Component, computed, input } from '@angular/core';

/**
 * Une case de la jauge, d'une personne : dans la zone du minimum au maximum, remplie, ou au-delà du
 * maximum. `boundBefore` et `boundAfter` : une borne tombe avant elle, ou après la dernière.
 */
type Cell = {
  zone: boolean;
  filled: boolean;
  over: boolean;
  boundBefore: boolean;
  boundAfter: boolean;
};

/**
 * Jauge d'un nombre face à des places (docs/design/patterns.md, Jauge) : des cases bout à bout, une
 * par personne (inscrit d'une partie, participant d'un créneau). Les cases du minimum au maximum
 * sont claires, un trait marque chaque borne, et le remplissage va jusqu'au nombre. Au-delà du
 * maximum, les cases sont hachurées, en rouge pour un créneau (`overflow="danger"`). Remplissage
 * jaune pour une partie sous son minimum (`shortfall`). Décorative : les chiffres sont toujours
 * écrits à côté.
 */
@Component({
  selector: 'app-gauge',
  host: {
    'aria-hidden': 'true',
    '[class.danger]': "overflow() === 'danger'",
    '[class.shortfall]': 'shortfall()',
  },
  template: `
    @for (cell of cells(); track $index) {
      <span
        class="cell"
        [class.zone]="cell.zone"
        [class.filled]="cell.filled"
        [class.over]="cell.over"
      >
        @if (cell.boundBefore) {
          <span class="bound before"></span>
        }
        @if (cell.boundAfter) {
          <span class="bound after"></span>
        }
      </span>
    }
  `,
  styles: `
    @layer components {
      :host {
        --gauge-gap: 2px;

        display: flex;
        gap: var(--gauge-gap);
        height: var(--space-s);
      }

      /* Une case vide garde un contour, visible sur la carte comme sur le fond de la page. */
      .cell {
        position: relative;
        flex: 1;
        border-radius: 2px;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-muted) 80%, transparent);
      }

      .cell.zone {
        background: color-mix(in srgb, var(--text) 30%, var(--surface-3));
      }

      .cell.filled {
        background: color-mix(in srgb, var(--text) 35%, var(--text-muted));
      }

      :host(.shortfall) .cell.filled {
        background: var(--warning);
      }

      .cell.over {
        background: repeating-linear-gradient(-45deg, var(--text-muted) 0 2px, transparent 2px 4px);
      }

      :host(.danger) .cell.over {
        background: repeating-linear-gradient(-45deg, var(--danger) 0 2px, transparent 2px 4px);
      }

      /* Une borne se place dans l'espace entre deux cases. */
      .bound {
        position: absolute;
        inset-block: calc(-1 * var(--space-xxs));
        width: 2px;
        background: var(--text);
      }

      .bound.before {
        left: calc(-1px - var(--gauge-gap) / 2);
      }

      .bound.after {
        right: calc(-1px - var(--gauge-gap) / 2);
      }
    }
  `,
})
export class Gauge {
  readonly count = input.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  /** Les hachures au-delà du maximum : neutres, ou rouges pour un créneau. */
  readonly overflow = input<'neutral' | 'danger'>('neutral');
  /** Le remplissage en jaune : une partie sous son minimum, d'après le drapeau reçu. */
  readonly shortfall = input(false);

  /** Une case par place jusqu'au maximum, ou par personne si le nombre le dépasse ; une au moins. */
  protected readonly cells = computed((): Cell[] => {
    const [count, min, max] = [this.count(), this.min(), this.max()];
    const length = Math.max(max, count, 1);
    const isBound = (position: number) => position > 0 && (position === min || position === max);
    return Array.from({ length }, (_, index) => ({
      zone: index >= min && index < max,
      filled: index < Math.min(count, max),
      over: index >= max && index < count,
      boundBefore: isBound(index),
      boundAfter: index === length - 1 && isBound(length),
    }));
  });
}
