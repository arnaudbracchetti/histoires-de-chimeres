import { Injectable, signal } from '@angular/core';

/**
 * Région `aria-live="polite"` commune à la coquille : chaque écriture réussie y est annoncée aux
 * lecteurs d'écran (« Partie déplacée : créneau 2, table Dragon. »).
 */
@Injectable({ providedIn: 'root' })
export class Announcer {
  private readonly current = signal('');
  readonly message = this.current.asReadonly();

  announce(message: string): void {
    // Vidée d'abord, pour qu'un même message soit annoncé deux fois de suite.
    this.current.set('');
    setTimeout(() => this.current.set(message));
  }
}
