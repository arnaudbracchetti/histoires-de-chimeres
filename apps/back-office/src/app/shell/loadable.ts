import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, input, signal, type Resource } from '@angular/core';
import type { ProblemDto } from '@chimeres/contract';
import { Button } from '../ui/button';

/** Ce que la zone lit d'une ressource (`apiResource()`, `httpResource()`). */
export type LoadableResource = Pick<Resource<unknown>, 'isLoading' | 'error'> & {
  reload(): boolean;
};

/** Texte d'un 403 sans Problem Details : celui de l'API, `access-denied`. */
const DENIED = 'Ton compte ne donne pas accès à cette page.';

/** Délai avant la barre de progression : une lecture rapide n'affiche rien. */
const PROGRESS_DELAY_MS = 300;

/**
 * Zone de contenu d'une lecture (docs/design/patterns.md, Chargement) : rien pendant 300 ms, puis
 * une barre de progression, `aria-busy` pendant toute la lecture ; en cas d'échec, `failure` et
 * « Réessayer » à la place du contenu. Une ressource absente (404) affiche `notFound`, s'il est
 * donné, sans « Réessayer » : relire n'y changerait rien. Un refus faute de droit (403) affiche le
 * texte de l'API, sans « Réessayer » non plus.
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
        @if (denied(); as refusal) {
          <p class="denied">{{ refusal.title }}</p>
          <p>{{ refusal.detail }}</p>
        } @else if (missing(); as message) {
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

      .denied {
        color: var(--text);
        font-weight: 600;
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

  /**
   * Le refus de l'API, si la lecture a échoué faute de droit (403) : une entrée d'Organisateur
   * ouverte par URL par un MJ. Relire n'y changerait rien.
   */
  protected readonly denied = computed(() => {
    const error = this.resource().error();
    if (!(error instanceof HttpErrorResponse) || error.status !== 403) return undefined;
    const problem = error.error as Partial<ProblemDto> | null;
    return {
      title: problem?.title ?? 'Accès refusé',
      detail: problem?.detail ?? DENIED,
    };
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
