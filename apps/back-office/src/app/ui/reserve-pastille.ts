import { booleanAttribute, Component, input } from '@angular/core';
import { Icon } from './icon';

/**
 * La pastille d'un scénario de la réserve (docs/design/patterns.md, Statuts) : « Programmé » en
 * vert (`circle-check`), ou « En réserve » en gris (`inbox`). Le libellé vient du contenu.
 */
@Component({
  selector: 'app-reserve-pastille',
  imports: [Icon],
  host: { '[class.scheduled]': 'scheduled()' },
  template: `<app-icon [name]="scheduled() ? 'circle-check' : 'inbox'" /><ng-content />`,
  styles: `
    @layer components {
      :host {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
        white-space: nowrap;
      }

      :host(.scheduled) {
        color: var(--success);
      }
    }
  `,
})
export class ReservePastille {
  readonly scheduled = input(false, { transform: booleanAttribute });
}
