import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiUrl, pushSubscriptionEndpoints } from '@chimeres/contract';
import { LinkedPhone } from '../linked-phone';
import { PageVisibility } from '../participant-data/page-visibility';
import { BrowserPush } from './browser-push';
import { PushNotifications } from './push-notifications';

describe('PushNotifications', () => {
  const subscription = {
    endpoint: 'https://push.example/a',
    keys: { p256dh: 'clé', auth: 'secret' },
  };
  let browser: {
    supported: ReturnType<typeof vi.fn>;
    permission: ReturnType<typeof vi.fn>;
    requestPermission: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    installedApp: ReturnType<typeof vi.fn>;
    iOSVersion: ReturnType<typeof vi.fn>;
    androidBrowser: ReturnType<typeof vi.fn>;
    onPermissionChange: ReturnType<typeof vi.fn>;
  };
  /** Ce que le navigateur appelle quand la permission change, sans quitter la page. */
  let permissionChanged: () => void;
  const nickname = signal<string | null | undefined>(undefined);
  const visible = signal(true);

  beforeEach(() => {
    nickname.set(undefined);
    visible.set(true);
    browser = {
      supported: vi.fn(() => true),
      permission: vi.fn(() => 'default'),
      requestPermission: vi.fn(async () => 'granted'),
      subscribe: vi.fn(async () => subscription),
      installedApp: vi.fn(() => false),
      iOSVersion: vi.fn(() => null),
      androidBrowser: vi.fn(() => 'chrome'),
      onPermissionChange: vi.fn((listener: () => void) => (permissionChanged = listener)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BrowserPush, useValue: browser },
        { provide: LinkedPhone, useValue: { nickname } },
        { provide: PageVisibility, useValue: { visible } },
      ],
    });
  });

  afterEach(() => http().verify());

  const http = () => TestBed.inject(HttpTestingController);
  const settle = async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
    }
  };

  /** Le service, une fois la clé publique lue (`null` : le serveur n'a pas de clés VAPID). */
  async function opened(publicKey: string | null): Promise<PushNotifications> {
    const push = TestBed.inject(PushNotifications);
    TestBed.tick();
    const request = http().expectOne(apiUrl(pushSubscriptionEndpoints.readPublicKey));
    if (publicKey) request.flush({ publicKey });
    else {
      request.flush(
        { code: 'push-not-configured', title: 'Notifications non prises en charge', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    }
    await settle();
    return push;
  }

  const saved = () => http().match({ method: 'PUT', url: apiUrl(pushSubscriptionEndpoints.save) });

  it('n’est pas pris en charge par un navigateur sans push, sans rien demander à l’API', () => {
    browser.supported.mockReturnValue(false);

    const push = TestBed.inject(PushNotifications);
    TestBed.tick();

    expect(push.status()).toBe('unsupported');
  });

  it('n’est pas pris en charge quand le serveur n’a pas de clés VAPID (NO-6)', async () => {
    const push = await opened(null);

    expect(push.status()).toBe('unsupported');
  });

  it('ne demande pas l’autorisation du téléphone sans un tap', async () => {
    nickname.set('Élodie');
    const push = await opened('BPublique');

    expect(push.status()).toBe('default');
    expect(browser.requestPermission).not.toHaveBeenCalled();
    expect(browser.subscribe).not.toHaveBeenCalled();
  });

  it('s’abonne après l’autorisation, et range l’abonnement sur le téléphone relié', async () => {
    nickname.set('Élodie');
    const push = await opened('BPublique');

    await push.activate();
    await settle();

    expect(push.status()).toBe('granted');
    expect(browser.subscribe).toHaveBeenCalledWith('BPublique');
    const [request] = saved();
    expect(request!.request.body).toEqual(subscription);
    request!.flush(null);
  });

  it('garde le refus du téléphone, sans s’abonner', async () => {
    nickname.set('Élodie');
    browser.requestPermission.mockResolvedValue('denied');
    const push = await opened('BPublique');

    await push.activate();
    await settle();

    expect(push.status()).toBe('denied');
    expect(browser.subscribe).not.toHaveBeenCalled();
  });

  it('renvoie l’abonnement à l’ouverture, quand le téléphone est relié et autorisé', async () => {
    browser.permission.mockReturnValue('granted');
    nickname.set('Élodie');
    await opened('BPublique');

    saved()[0]!.flush(null);
  });

  it('renvoie l’abonnement après chaque liaison', async () => {
    browser.permission.mockReturnValue('granted');
    nickname.set(null);
    await opened('BPublique');
    expect(saved()).toHaveLength(0);

    nickname.set('Brann');
    await settle();

    saved()[0]!.flush(null);
  });

  it('relit l’autorisation quand Chrome la change, sans quitter la page : réactivée, elle abonne', async () => {
    browser.permission.mockReturnValue('denied');
    nickname.set('Élodie');
    const push = await opened('BPublique');

    browser.permission.mockReturnValue('granted');
    permissionChanged();
    await settle();

    expect(push.status()).toBe('granted');
    saved()[0]!.flush(null);
  });

  it('relit l’autorisation au retour au premier plan : réactivée dans les réglages, elle abonne', async () => {
    browser.permission.mockReturnValue('denied');
    nickname.set('Élodie');
    const push = await opened('BPublique');

    visible.set(false);
    TestBed.tick();
    browser.permission.mockReturnValue('granted');
    visible.set(true);
    await settle();

    expect(push.status()).toBe('granted');
    saved()[0]!.flush(null);
  });

  describe('sur iPhone', () => {
    /** Safari : pas de `Notification` hors de l'écran d'accueil, donc pas de push. */
    function inSafari(version: [number, number]): void {
      browser.iOSVersion.mockReturnValue(version);
      browser.supported.mockReturnValue(false);
    }

    it('demande l’ajout à l’écran d’accueil, dans Safari, sous iOS 16.4 ou plus (NO-6)', async () => {
      inSafari([16, 4]);

      const push = await opened('BPublique');

      expect(push.status()).toBe('not-on-home-screen');
    });

    it('ne demande pas l’ajout à l’écran d’accueil sous iOS 16.3 ou moins : rien à recevoir', () => {
      inSafari([16, 3]);

      const push = TestBed.inject(PushNotifications);
      TestBed.tick();

      expect(push.status()).toBe('unsupported');
    });

    it('ne demande pas l’ajout à l’écran d’accueil quand le serveur n’a pas de clés VAPID', async () => {
      inSafari([18, 6]);

      const push = await opened(null);

      expect(push.status()).toBe('unsupported');
    });

    it('suit la permission dans l’application de l’écran d’accueil', async () => {
      browser.iOSVersion.mockReturnValue([17, 2]);
      browser.installedApp.mockReturnValue(true);
      browser.permission.mockReturnValue('denied');

      const push = await opened('BPublique');

      expect(push.status()).toBe('denied');
    });
  });

  describe('chemin des réglages après un refus', () => {
    it('passe par les Réglages de l’iPhone', () => {
      browser.supported.mockReturnValue(false);
      browser.iOSVersion.mockReturnValue([17, 2]);
      browser.installedApp.mockReturnValue(true);

      expect(TestBed.inject(PushNotifications).settingsPath).toBe('iphone');
    });

    it('passe par les infos de l’application installée sur Android', () => {
      browser.supported.mockReturnValue(false);
      browser.installedApp.mockReturnValue(true);

      expect(TestBed.inject(PushNotifications).settingsPath).toBe('installed-app');
    });

    it.each(['chrome', 'samsung', 'firefox'])(
      'passe par les réglages du navigateur, propres à %s',
      (androidBrowser) => {
        browser.supported.mockReturnValue(false);
        browser.androidBrowser.mockReturnValue(androidBrowser);

        expect(TestBed.inject(PushNotifications).settingsPath).toBe(androidBrowser);
      },
    );
  });
});
