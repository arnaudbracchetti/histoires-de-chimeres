import { TestBed } from '@angular/core/testing';
import { AppInstallation } from './app-installation';
import { BrowserInstall, type InstallPrompt } from './browser-install';

describe('AppInstallation', () => {
  let browser: {
    isAndroid: ReturnType<typeof vi.fn>;
    isStandalone: ReturnType<typeof vi.fn>;
    hasInstalledRelatedApp: ReturnType<typeof vi.fn>;
    onBeforeInstallPrompt: ReturnType<typeof vi.fn>;
    onAppInstalled: ReturnType<typeof vi.fn>;
    isAdviceDismissed: ReturnType<typeof vi.fn>;
    dismissAdvice: ReturnType<typeof vi.fn>;
  };
  /** Ce que Chrome envoie à la page : le bouton « Installer » armé, puis l'application installée. */
  let beforeInstallPrompt: (prompt: InstallPrompt) => void;
  let appInstalled: () => void;

  beforeEach(() => {
    browser = {
      isAndroid: vi.fn(() => true),
      isStandalone: vi.fn(() => false),
      hasInstalledRelatedApp: vi.fn(async () => false),
      onBeforeInstallPrompt: vi.fn((listener) => (beforeInstallPrompt = listener)),
      onAppInstalled: vi.fn((listener) => (appInstalled = listener)),
      isAdviceDismissed: vi.fn(() => false),
      dismissAdvice: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [{ provide: BrowserInstall, useValue: browser }] });
  });

  const installation = () => TestBed.inject(AppInstallation);
  const settle = () => new Promise((resolve) => setTimeout(resolve));
  const aPrompt = () => ({ prompt: vi.fn(async () => undefined) });

  it('propose l’installation sur Android, dans le navigateur, avec le conseil de l’Accueil', () => {
    expect(installation().offered()).toBe(true);
    expect(installation().advice()).toBe('install');
  });

  it('ne propose rien hors d’Android', () => {
    browser.isAndroid.mockReturnValue(false);

    expect(installation().offered()).toBe(false);
    expect(installation().advice()).toBeNull();
  });

  it('ne propose rien dans l’application installée', () => {
    browser.isStandalone.mockReturnValue(true);

    expect(installation().offered()).toBe(false);
    expect(installation().advice()).toBeNull();
    expect(browser.onAppInstalled).not.toHaveBeenCalled();
  });

  it('arme « Installer » à chaque beforeinstallprompt, réarmé après « Annuler »', async () => {
    const first = aPrompt();
    expect(installation().armed()).toBe(false);

    beforeInstallPrompt(first);
    expect(installation().armed()).toBe(true);

    await installation().install();
    expect(first.prompt).toHaveBeenCalledOnce();
    expect(installation().armed()).toBe(false);

    // « Annuler » : Chrome renvoie aussitôt l'événement.
    const second = aPrompt();
    beforeInstallPrompt(second);
    await installation().install();
    expect(second.prompt).toHaveBeenCalledOnce();
    expect(first.prompt).toHaveBeenCalledOnce();
  });

  it('montre « L’application est installée » au premier appinstalled, puis propose de l’ouvrir', () => {
    installation();
    beforeInstallPrompt(aPrompt());

    appInstalled();

    expect(installation().justInstalled()).toBe(true);
    expect(installation().offered()).toBe(false);
    expect(installation().armed()).toBe(false);
    expect(installation().advice()).toBe('open');
  });

  it('ignore le doublon d’appinstalled, même après « Rester dans le navigateur »', () => {
    installation();
    appInstalled();
    installation().stayInBrowser();

    appInstalled();

    expect(installation().justInstalled()).toBe(false);
    expect(installation().advice()).toBe('open');
  });

  it('propose d’ouvrir l’application que Chrome voit installée, sans l’écran « installée »', async () => {
    browser.hasInstalledRelatedApp.mockResolvedValue(true);
    installation();
    await settle();

    expect(installation().offered()).toBe(false);
    expect(installation().justInstalled()).toBe(false);
    expect(installation().advice()).toBe('open');
  });

  it('écarte le conseil d’installer par son « Plus tard », pour de bon', () => {
    installation().dismissAdvice();

    expect(browser.dismissAdvice).toHaveBeenCalled();
    expect(installation().advice()).toBeNull();
    expect(installation().offered()).toBe(true);
  });

  it('n’affiche plus le conseil écarté à une autre ouverture', () => {
    browser.isAdviceDismissed.mockReturnValue(true);

    expect(installation().advice()).toBeNull();
  });
});
