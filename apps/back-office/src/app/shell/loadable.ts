import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, input, signal, type Resource } from '@angular/core';
import { Button } from '../ui/button';

/** Ce que la zone lit d'une ressource (`apiResource()`, `httpResource()`). */
export type LoadableResource = Pick<Resource<unknown>, 'isLoading' | 'error'> & {
  reload(): boolean;
};

/** Délai avant la barre de progression : une lecture rapide n'affiche rien. */
const PROGRESS_DELAY_MS = 300;

/**
 * Zone de contenu d'une lecture (docs/design/patterns.md, Chargement) : rien pendant 300 ms, puis
 * une barre de progression, `aria-busy` pendant toute la lecture ; en cas d'échec, `failure` et
 * « Réessayer » à la place du contenu. Une ressource absente (404) affiche `notFound`, s'il est
 * donné, sans « Réessayer » : relire n'y changerait rien.
 */
@Component({
  selector: 'app-loadable',
  imports: [Button],
  host: { '[attr.aria-busy]': 'resource().isLoading()' },
  template: `
    @if (slow()) {
      <div class="progress" role="progressbar" aria-label="Chargement"></div>
    }
    @if (resource().error() && !resource().isLoading()) {
      <div class="failure">
        @if (missing(); as message) {
          <p>{{ message }}</p>
        } @else {
          <p>{{ failure() }}</p>
          <button type="button" appButton="secondary" (click)="resource().reload()">
            Réessayer
          </button>
        }
      </div>
    } @else {
      <ng-content />
    }
  `,
  styles: `
    @layer components {
      :host {
        position: relative;
        display: block;
      }

      .progress {
        position: absolute;
        inset: 0 0 auto;
        height: 2px;
        overflow: hidden;

        &::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 30%;
          background: var(--accent);
          animation: progress 1.2s ease-in-out infinite;
        }
      }

      @keyframes progress {
        from {
          left: -30%;
        }
        to {
          left: 100%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .progress::before {
          width: 100%;
          animation: none;
        }
      }

      .failure {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        align-items: flex-start;
        padding: var(--space-s) 0;
        color: var(--text-muted);
      }
    }
  `,
})
export class Loadable {
  readonly resource = input.required<LoadableResource>();
  /** Message sobre de l'échec : « Impossible de charger les scénarios. » */
  readonly failure = input.required<string>();
  /** Message d'une ressource absente (404) : « Ce MJ n'existe pas, ou plus. » */
  readonly notFound = input<string>();

  /** `notFound`, si la lecture a échoué parce que la ressource n'existe pas. */
  protected readonly missing = computed(() => {
    const error = this.resource().error();
    return error instanceof HttpErrorResponse && error.status === 404 ? this.notFound() : undefined;
  });

  protected readonly slow = signal(false);

  constructor() {
    effect((onCleanup) => {
      this.slow.set(false);
      if (!this.resource().isLoading()) return;
      const timer = setTimeout(() => this.slow.set(true), PROGRESS_DELAY_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
