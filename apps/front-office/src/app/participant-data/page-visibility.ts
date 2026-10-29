import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal, type Signal } from '@angular/core';

/**
 * La page est-elle visible ? Elle se cache quand l'application passe en arrière-plan, et redevient
 * visible au retour au premier plan. Injectée pour que `ParticipantData` se teste seul (ADR 0011).
 */
@Injectable({ providedIn: 'root' })
export class PageVisibility {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal(this.document.visibilityState === 'visible');

  readonly visible: Signal<boolean> = this.state.asReadonly();

  constructor() {
    const update = () => this.state.set(this.document.visibilityState === 'visible');
    this.document.addEventListener('visibilitychange', update);
    inject(DestroyRef).onDestroy(() =>
      this.document.removeEventListener('visibilitychange', update),
    );
  }
}
