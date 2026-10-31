import { computed, inject, Injectable, signal } from '@angular/core';
import { BrowserInstall, type InstallPrompt } from './browser-install';

/**
 * L'installation de l'application sur Android, depuis le navigateur (§4.2, #61) : le bouton « Installer »,
 * armé par `beforeinstallprompt` ; l'écran « L'application est installée », au premier
 * `appinstalled` (Chrome l'envoie deux fois) ; et la carte de l'Accueil, qui conseille d'installer,
 * ou d'ouvrir l'application que Chrome voit installée. Dans l'application, rien de tout ça.
 */
@Injectable({ providedIn: 'root' })
export class AppInstallation {
  private readonly browser = inject(BrowserInstall);

  /** Android, dans le navigateur : hors de l'application installée. */
  private readonly inBrowser = this.browser.isAndroid() && !this.browser.isStandalone();
  /** Le dernier `beforeinstallprompt`, pas encore servi. */
  private readonly prompt = signal<InstallPrompt | null>(null);
  private readonly installed = signal(false);
  private readonly adviceDismissed = signal(this.browser.isAdviceDismissed());

  /** L'étape « Installe l'application » a lieu d'être. */
  readonly offered = computed(() => this.inBrowser && !this.installed());
  /** Le bouton « Installer » ouvre la fenêtre de Chrome. */
  readonly armed = computed(() => !!this.prompt());
  /** L'installation vient de se faire : l'écran « L'application est installée » est à montrer. */
  readonly justInstalled = signal(false);

  /** La carte en tête de l'Accueil : conseiller d'installer, ou d'ouvrir l'application. */
  readonly advice = computed<'install' | 'open' | null>(() => {
    if (!this.inBrowser) return null;
    if (this.installed()) return 'open';
    return this.adviceDismissed() ? null : 'install';
  });

  constructor() {
    if (!this.inBrowser) return;
    this.browser.onBeforeInstallPrompt((prompt) => this.prompt.set(prompt));
    this.browser.onAppInstalled(() => this.markInstalled());
    void this.browser.hasInstalledRelatedApp().then((found) => {
      if (found) this.installed.set(true);
    });
  }

  /**
   * « Installer » : la fenêtre de Chrome. Un événement ne sert qu'une fois ; après « Annuler »,
   * Chrome en renvoie un autre, qui réarme le bouton.
   */
  async install(): Promise<void> {
    const prompt = this.prompt();
    if (!prompt) return;
    this.prompt.set(null);
    await prompt.prompt();
  }

  /** « Rester dans le navigateur » : l'Accueil, avec sa carte « Ouvrir l'application ». */
  stayInBrowser(): void {
    this.justInstalled.set(false);
  }

  /** « Plus tard » de la carte : le conseil d'installer ne revient plus sur ce téléphone. */
  dismissAdvice(): void {
    this.browser.dismissAdvice();
    this.adviceDismissed.set(true);
  }

  /** Le second `appinstalled`, quelques secondes après le premier, ne change rien. */
  private markInstalled(): void {
    if (this.installed()) return;
    this.installed.set(true);
    this.justInstalled.set(true);
    this.prompt.set(null);
  }
}
