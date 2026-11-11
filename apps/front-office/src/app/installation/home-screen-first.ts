import { computed, inject, Injectable, signal } from '@angular/core';
import { PushNotifications } from '../notifications/push-notifications';

/**
 * « Installer d'abord », sur iPhone (§4.2, #81) : dans le navigateur, où les notifications
 * n'arrivent pas, « Installe l'application » passe avant le pseudo, qu'on ne tape qu'une fois, dans
 * l'application installée. « Continuer dans Safari, sans notifications » rend le pseudo, le temps de
 * cette ouverture.
 */
@Injectable({ providedIn: 'root' })
export class HomeScreenFirst {
  private readonly push = inject(PushNotifications);
  private readonly continuedInBrowser = signal(false);

  /** L'écran « Installe l'application » passe avant le pseudo. */
  readonly due = computed(
    () => this.push.status() === 'not-on-home-screen' && !this.continuedInBrowser(),
  );

  continueInBrowser(): void {
    this.continuedInBrowser.set(true);
  }
}
