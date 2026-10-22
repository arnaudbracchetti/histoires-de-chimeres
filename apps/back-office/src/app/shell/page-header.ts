import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Un niveau du fil d'Ariane, au-dessus de la page courante. */
export type Crumb = { label: string; link: string };

/**
 * En-tête d'une page : fil d'Ariane dès le second niveau, h1 en Uncial Antiqua, et à droite une
 * seule action principale, projetée.
 */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink],
  template: `
    <div class="titles">
      @if (trail().length) {
        <nav aria-label="Fil d'Ariane">
          <ol>
            @for (crumb of trail(); track crumb.link) {
              <li><a [routerLink]="crumb.link">{{ crumb.label }}</a></li>
            }
            <li aria-current="page">{{ title() }}</li>
          </ol>
        </nav>
      }
      <h1 tabindex="-1">{{ title() }}</h1>
    </div>
    <ng-content />
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        gap: var(--space-l);
        align-items: flex-end;
        justify-content: space-between;
        padding: var(--space-l) var(--space-xl);
        border-bottom: 1px solid var(--border);
        background: var(--surface-1);
      }

      ol {
        display: flex;
        margin: 0 0 var(--space-xs);
        padding: 0;
        list-style: none;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      li + li::before {
        content: '›';
        margin: 0 var(--space-xs);
      }

      a {
        color: var(--text-muted);

        &:hover {
          color: var(--text);
        }
      }

      h1:focus {
        outline: none;
      }
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly trail = input<readonly Crumb[]>([]);
}
