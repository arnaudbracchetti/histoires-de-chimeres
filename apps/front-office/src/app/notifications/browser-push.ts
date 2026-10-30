import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import type { PushSubscriptionBody } from '@chimeres/contract';

/**
 * Le push du navigateur : la permission des notifications, et l'abonnement par le service worker
 * d'Angular. Injecté pour que `PushNotifications` se teste seul.
 */
@Injectable({ providedIn: 'root' })
export class BrowserPush {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly swPush = inject(SwPush, { optional: true });

  /** Le service worker tourne (pas en dev), et le navigateur connaît le push. */
  supported(): boolean {
    return (
      !!this.swPush?.isEnabled &&
      !!this.window &&
      'Notification' in this.window &&
      'PushManager' in this.window
    );
  }

  permission(): NotificationPermission {
    return Notification.permission;
  }

  /**
   * Appelle `listener` quand la permission change sans que la page se cache : dans Chrome, on la
   * réactive depuis l'icône à gauche de l'adresse, la page restant visible.
   */
  onPermissionChange(listener: () => void): void {
    void this.window?.navigator.permissions
      ?.query({ name: 'notifications' })
      .then((status) => status.addEventListener('change', listener))
      .catch(() => undefined);
  }

  /** Ouvre la demande du téléphone : à n'appeler qu'après un tap. */
  requestPermission(): Promise<NotificationPermission> {
    return Notification.requestPermission();
  }

  /** L'abonnement de ce navigateur, existant ou nouveau, sous la clé publique du serveur. */
  async subscribe(publicKey: string): Promise<PushSubscriptionBody> {
    const subscription = await this.swPush!.requestSubscription({ serverPublicKey: publicKey });
    return subscription.toJSON() as PushSubscriptionBody;
  }

  /** L'application installée, ouverte hors du navigateur : ses réglages ne sont pas ceux de Chrome. */
  installedApp(): boolean {
    return !!this.window?.matchMedia?.('(display-mode: standalone)').matches;
  }
}
