import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { pushSubscriptionEndpoints } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { LinkedPhone } from '../linked-phone';
import { PageVisibility } from '../participant-data/page-visibility';
import { readProblem } from '../problem';
import { BrowserPush } from './browser-push';

/**
 * Où en sont les notifications de ce téléphone (NO-6) : pas prises en charge (navigateur sans push,
 * ou serveur sans clés VAPID), ou la permission du téléphone.
 */
export type PushStatus = 'unsupported' | NotificationPermission;

/**
 * Les notifications du téléphone : leur état, la demande d'autorisation après un tap, et
 * l'abonnement, renvoyé à l'API à chaque ouverture et après chaque liaison, tant que le téléphone
 * est relié et autorisé. La permission se relit quand le navigateur la change, et au retour au
 * premier plan : réactivée dans les réglages, elle abonne sans geste de plus.
 */
@Injectable({ providedIn: 'root' })
export class PushNotifications {
  private readonly browser = inject(BrowserPush);
  private readonly apiCall = injectApiCall();
  private readonly linkedPhone = inject(LinkedPhone);
  private readonly visibility = inject(PageVisibility);

  private readonly supported = this.browser.supported();
  /** La clé publique VAPID : `undefined` tant qu'on ne l'a pas lue, `null` si le serveur n'en a pas. */
  private readonly publicKey = signal<string | null | undefined>(undefined);
  private readonly permission = signal<NotificationPermission>(
    this.supported ? this.browser.permission() : 'denied',
  );

  readonly status = computed<PushStatus>(() =>
    !this.supported || this.publicKey() === null ? 'unsupported' : this.permission(),
  );

  /** L'application installée : le chemin des réglages passe par ses infos, pas par Chrome. */
  readonly installedApp = this.browser.installedApp();

  constructor() {
    if (!this.supported) return;
    void this.readPublicKey();
    this.browser.onPermissionChange(() => this.permission.set(this.browser.permission()));
    effect(() => {
      if (this.visibility.visible()) this.permission.set(this.browser.permission());
    });
    effect(() => {
      const publicKey = this.publicKey();
      if (publicKey && this.linkedPhone.nickname() && this.permission() === 'granted') {
        void this.subscribe(publicKey);
      }
    });
  }

  /** « Activer les notifications » : la demande du téléphone, puis son verdict. */
  async activate(): Promise<NotificationPermission> {
    const permission = await this.browser.requestPermission();
    this.permission.set(permission);
    return permission;
  }

  /** Sans réseau, la clé reste inconnue : l'état suit la permission, et l'abonnement attendra. */
  private async readPublicKey(): Promise<void> {
    try {
      const { publicKey } = await this.apiCall(pushSubscriptionEndpoints.readPublicKey);
      this.publicKey.set(publicKey);
    } catch (error) {
      if (readProblem(error).code === 'push-not-configured') this.publicKey.set(null);
    }
  }

  /** Un échec se tait : le prochain renvoi rattrapera l'abonnement. */
  private async subscribe(publicKey: string): Promise<void> {
    try {
      const subscription = await this.browser.subscribe(publicKey);
      await this.apiCall(pushSubscriptionEndpoints.save, { body: subscription });
    } catch {
      // Rien à montrer : le bandeau ne dépend que de la permission.
    }
  }
}
