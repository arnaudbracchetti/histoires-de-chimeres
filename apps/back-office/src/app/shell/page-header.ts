import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Un niveau du fil d'Ariane, au-dessus de la page courante. */
export type Crumb = { label: string; link: string };

/** Gabarit d'une page : une colonne de `--page-width`, ou toute la largeur (docs/design/patterns.md). */
export type PageWidth = 'column' | 'full';

/**
 * En-tête d'une page : fil d'Ariane dès le second niveau, h1 en Uncial Antiqua, et à droite une
 * seule action principale, projetée. Son fond court sur toute la largeur ; son contenu suit le
 * gabarit de la page, pour que l'action tombe au-dessus du bord droit du contenu. Ce qui porte `appPageTitle` se place à côté du h1, ce qui
 * porte `appPageSubtitle` dessous ; `titleHidden` retire le h1, pour modifier le titre dans un
 * champ en place.
 */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink],
  host: { '[class.full]': "width() === 'full'" },
  template: `
    <div class="titles">
      @if (trail().length) {
        <nav aria-label="Fil d'Ariane">
          <ol>
            @for (crumb of trail(); track crumb.link) {
              <li>
                <a [routerLink]="crumb.link">{{ crumb.label }}</a>
              </li>
            }
            <li aria-current="page">{{ title() }}</li>
          </ol>
        </nav>
      }
      <div class="title-line">
        @if (!titleHidden()) {
          <h1 tabindex="-1">{{ title() }}</h1>
        }
        <ng-content select="[appPageTitle]" />
      </div>
      <ng-content select="[appPageSubtitle]" />
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
        padding-right: max(var(--space-xl), 100% - var(--page-width) - var(--space-xl));
        border-bottom: 1px solid var(--border);
        background: var(--surface-1);
      }

      :host(.full) {
        padding-right: var(--space-xl);
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

      .title-line {
        display: flex;
        gap: var(--space-s);
        align-items: center;
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
  readonly titleHidden = input(false);
  readonly width = input<PageWidth>('column');
}
