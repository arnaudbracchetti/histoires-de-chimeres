import { Component, computed, input } from '@angular/core';

/**
 * Jauge d'un nombre face à des places (docs/design/patterns.md, Jauge) : une zone claire du minimum
 * au maximum, un trait à chaque borne, et un remplissage jusqu'au nombre, au plus le maximum.
 * Au-delà du maximum, des hachures, rouges pour un créneau (`overflow="danger"`). Chaque jauge a sa
 * propre échelle. Décorative : les chiffres sont toujours écrits à côté.
 */
@Component({
  selector: 'app-gauge',
  host: { 'aria-hidden': 'true', '[class.danger]': "overflow() === 'danger'" },
  template: `
    <span
      class="zone"
      [style.left.%]="percent(min())"
      [style.width.%]="percent(max() - min())"
    ></span>
    <span class="fill" [style.width.%]="percent(filled())"></span>
    @if (count() > max()) {
      <span
        class="over"
        [style.left.%]="percent(max())"
        [style.width.%]="percent(count() - max())"
      ></span>
    }
    <span class="bound" [style.left.%]="percent(min())"></span>
    <span class="bound" [style.left.%]="percent(max())"></span>
  `,
  styles: `
    @layer components {
      :host {
        position: relative;
        display: block;
        height: var(--space-s);
        border-radius: 999px;
        background: var(--surface-3);
      }

      span {
        position: absolute;
        inset-block: 0;
      }

      .zone {
        background: color-mix(in srgb, var(--text) 18%, var(--surface-3));
      }

      .fill {
        left: 0;
        border-radius: 999px 0 0 999px;
        background: var(--text-muted);
      }

      .over {
        background: repeating-linear-gradient(-45deg, var(--text-muted) 0 2px, transparent 2px 4px);
      }

      :host(.danger) .over {
        background: repeating-linear-gradient(-45deg, var(--danger) 0 2px, transparent 2px 4px);
      }

      .bound {
        inset-block: calc(-1 * var(--space-xxs));
        width: 2px;
        margin-left: -1px;
        background: var(--text);
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

  /** L'échelle : le maximum, ou le nombre s'il le dépasse. */
  private readonly scale = computed(() => Math.max(this.max(), this.count(), 1));

  protected readonly filled = computed(() => Math.min(this.count(), this.max()));

  protected percent(value: number): number {
    return (value / this.scale()) * 100;
  }
}
