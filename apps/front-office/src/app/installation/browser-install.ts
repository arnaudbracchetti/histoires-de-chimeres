import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

const ADVICE_DISMISSED_KEY = 'installAdviceDismissed';

/** L'événement `beforeinstallprompt` gardé : `prompt()` ouvre la fenêtre d'installation de Chrome. */
export type InstallPrompt = { prompt(): Promise<unknown> };

/**
 * L'installation de l'application vue du navigateur : le système, le mode d'affichage, les
 * événements de Chrome et le conseil écarté, gardé sur le téléphone. Injecté pour que
 * `AppInstallation` se teste seul.
 */
@Injectable({ providedIn: 'root' })
export class BrowserInstall {
  private readonly window = inject(DOCUMENT).defaultView;

  isAndroid(): boolean {
    return /Android/i.test(this.window?.navigator.userAgent ?? '');
  }

  /** L'application installée, ouverte hors du navigateur. */
  isStandalone(): boolean {
    return !!this.window?.matchMedia?.('(display-mode: standalone)').matches;
  }

  /**
   * Chrome voit-il l'application installée ? Il le dit par `getInstalledRelatedApps()`, grâce au
   * `related_applications` du manifeste. Ailleurs, la réponse est non.
   */
  async hasInstalledRelatedApp(): Promise<boolean> {
    const navigator = this.window?.navigator as
      (Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> }) | undefined;
    try {
      return !!(await navigator?.getInstalledRelatedApps?.())?.length;
    } catch {
      return false;
    }
  }

  /**
   * Appelle `listener` à chaque `beforeinstallprompt`, sans l'invite de Chrome : c'est le bouton
   * « Installer » de la page qui l'ouvre.
   */
  onBeforeInstallPrompt(listener: (prompt: InstallPrompt) => void): void {
    this.window?.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      listener(event as Event & InstallPrompt);
    });
  }

  onAppInstalled(listener: () => void): void {
    this.window?.addEventListener('appinstalled', listener);
  }

  isAdviceDismissed(): boolean {
    try {
      return localStorage.getItem(ADVICE_DISMISSED_KEY) !== null;
    } catch {
      return false;
    }
  }

  dismissAdvice(): void {
    try {
      localStorage.setItem(ADVICE_DISMISSED_KEY, 'true');
    } catch {
      // Stockage refusé (navigation privée) : le conseil ne reste écarté que pour cette ouverture.
    }
  }
}
