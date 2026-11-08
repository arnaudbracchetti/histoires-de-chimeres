import { Component, input } from '@angular/core';

/**
 * Un rond par créneau, dans une ligne de tableau (docs/design/patterns.md, Tableaux) : de même
 * taille quel que soit son remplissage, son chiffre dedans (rang ou nombre). Sa couleur vient de
 * `--pip-color`, que la liste donne ; cerclé du filet gravé sans elle. `fill` : vide (`null`), plein
 * (`solid`) ou teinté (`tint`). `dimmed` l'atténue, pour un créneau terminé. La liste le cache
 * au lecteur d'écran, et lui dit la même chose en texte.
 */
@Component({
  selector: 'app-pip',
  host: {
    '[class.solid]': "fill() === 'solid'",
    '[class.tint]': "fill() === 'tint'",
    '[class.dimmed]': 'dimmed()',
  },
  template: `<ng-content />`,
  styles: `
    @layer components {
      :host {
        display: inline-grid;
        place-items: center;
        box-sizing: border-box;
        width: 1.375rem;
        height: 1.375rem;
        border: 1px solid var(--pip-color, var(--engraving-strong));
        border-radius: 50%;
        color: var(--text-muted);
        font-size: var(--font-size-overline);
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }

      :host(.solid) {
        background: var(--pip-color);
        color: var(--on-accent);
        font-weight: 600;
      }

      :host(.tint) {
        background: color-mix(in srgb, var(--pip-color) 30%, transparent);
        color: var(--text);
        font-weight: 600;
      }

      :host(.dimmed) {
        opacity: 0.6;
      }
    }
  `,
})
export class Pip {
  readonly fill = input<'solid' | 'tint' | null>(null);
  readonly dimmed = input(false);
}
