import { Component, computed, input } from '@angular/core';
import { renderPresentation } from '@chimeres/design/presentation';

/**
 * Rendu de la présentation, tel que le front office l'affichera. Le HTML passe par `[innerHTML]`,
 * donc par le sanitizer d'Angular.
 */
@Component({
  selector: 'app-presentation-preview',
  template: `
    @if (text().trim()) {
      <!-- Le style du rendu est commun aux deux fronts : presentation.css, de @chimeres/design. -->
      <div class="presentation" [innerHTML]="html()"></div>
    } @else {
      <p class="empty">Rien à montrer pour l'instant&nbsp;: écris d'abord la présentation.</p>
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
