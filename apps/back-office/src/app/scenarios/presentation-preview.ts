import { Component, computed, input } from '@angular/core';
import { renderPresentation } from './presentation-markdown';

/**
 * Rendu de la présentation, tel que le front office l'affichera. Le HTML passe par `[innerHTML]`,
 * donc par le sanitizer d'Angular.
 */
@Component({
  selector: 'app-presentation-preview',
  template: `
    @if (text().trim()) {
      <div class="rendered" [innerHTML]="html()"></div>
    } @else {
      <p class="empty">Rien à montrer pour l'instant : écris d'abord la présentation.</p>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: block;
        min-height: 10lh;
        padding: var(--space-xs) var(--space-s);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-1);
      }

      .rendered {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        overflow-wrap: anywhere;
      }

      /* Le HTML rendu échappe à l'encapsulation des styles. */
      .rendered ::ng-deep :is(p, ul, ol) {
        margin: 0;
      }

      .rendered ::ng-deep :is(ul, ol) {
        padding-left: var(--space-l);
      }

      .empty {
        color: var(--text-muted);
      }
    }
  `,
})
export class PresentationPreview {
  readonly text = input.required<string>();

  protected readonly html = computed(() => renderPresentation(this.text()));
}
