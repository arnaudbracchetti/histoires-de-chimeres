import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { pushSubscriptionEndpoints } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { LinkedPhone } from '../linked-phone';
import { PageVisibility } from '../participant-data/page-visibility';
import { readProblem } from '../problem';
import { BrowserPush } from './browser-push';

/**
 * Où en sont les notifications de ce téléphone (NO-6) : pas prises en charge (navigateur sans push,
 * iPhone sous iOS 16.3 ou moins, ou serveur sans clés VAPID), iPhone hors de l'écran d'accueil, ou
 * la permission du téléphone.
 */
export type PushStatus = 'unsupported' | 'not-on-home-screen' | NotificationPermission;

/**
 * Où réactiver des notifications bloquées : les Réglages de l'iPhone, les infos de l'application
 * installée sur Android, ou l'icône à gauche de l'adresse dans le navigateur.
 */
export type SettingsPath = 'iphone' | 'installed-app' | 'browser';

/** Le push arrive sur iPhone avec iOS 16.4, pour l'application ajoutée à l'écran d'accueil. */
function canReceivePushOnHomeScreen([major, minor]: [number, number]): boolean {
  return major > 16 || (major === 16 && minor >= 4);
}

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
  private readonly iOSVersion = this.browser.iOSVersion();
  /** L'application installée, ouverte hors du navigateur. */
  private readonly installedApp = this.browser.installedApp();
  /**
   * Un iPhone, dans Safari, qui recevrait les notifications une fois l'application ajoutée à
   * l'écran d'accueil : hors de lui, `Notification` n'existe pas dans la page.
   */
  private readonly outsideHomeScreen =
    !!this.iOSVersion && !this.installedApp && canReceivePushOnHomeScreen(this.iOSVersion);
  /** La clé publique VAPID : `undefined` tant qu'on ne l'a pas lue, `null` si le serveur n'en a pas. */
  private readonly publicKey = signal<string | null | undefined>(undefined);
  private readonly permission = signal<NotificationPermission>(
    this.supported ? this.browser.permission() : 'denied',
  );

  readonly status = computed<PushStatus>(() => {
    if (this.publicKey() === null) return 'unsupported';
    if (this.outsideHomeScreen) return 'not-on-home-screen';
    return this.supported ? this.permission() : 'unsupported';
  });

  readonly settingsPath: SettingsPath = this.iOSVersion
    ? 'iphone'
    : this.installedApp
      ? 'installed-app'
      : 'browser';

  constructor() {
    // Hors de l'écran d'accueil, la clé dit encore si le serveur envoie quelque chose.
    if (this.supported || this.outsideHomeScreen) void this.readPublicKey();
    if (!this.supported) return;
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
