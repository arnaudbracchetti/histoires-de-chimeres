import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AccountStore } from '../account/account-store';
import { ConventionStore } from '../convention/convention-store';
import { formatConventionDate } from '@chimeres/design';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { ErrorDialog } from './error-dialog';
import { Loadable } from './loadable';
import { readProblem } from '../problem';

/** Clé de l'état replié, mémorisé par navigateur. */
const COLLAPSED_KEY = 'back-office.rail-collapsed';

/** Sous cette largeur, le rail se replie de lui-même (docs/design/patterns.md). */
const NARROW = '(max-width: 1279.98px)';

/** Une entrée du rail. */
type Entry = { label: string; icon: string; link: string };

const PREPARATION: readonly Entry[] = [
  { label: 'Calendrier', icon: 'calendar', link: '/' },
  { label: 'MJ', icon: 'users', link: '/mj' },
  { label: 'Scénarios', icon: 'book-open', link: '/scenarios' },
  { label: 'Créneaux et tables', icon: 'layout-grid', link: '/creneaux-et-tables' },
];

const DAY_OF: readonly Entry[] = [
  { label: 'Pilotage du jour J', icon: 'radio-tower', link: '/pilotage' },
  { label: 'Participants', icon: 'user-round', link: '/participants' },
  { label: 'Informations de connexion', icon: 'qr-code', link: '/informations-de-connexion' },
];

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function storeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    // Stockage refusé : l'état vaut pour cette page seulement.
  }
}

/**
 * Rail latéral de la coquille. Replié, il ne garde que les icônes : le libellé reste dans le lien,
 * masqué à l'écran, et sert d'infobulle et de nom accessible. En bas, le pseudo de la personne
 * connectée, qui mène à « Mon compte », et « Se déconnecter » ; sans session, « Se connecter ».
 */
@Component({
  selector: 'app-rail',
  imports: [Button, Icon, Loadable, RouterLink, RouterLinkActive],
  host: { '[class.collapsed]': 'collapsed()' },
  templateUrl: './rail.html',
  styleUrl: './rail.css',
})
export class Rail {
  protected readonly preparation = PREPARATION;
  protected readonly dayOf = DAY_OF;
  protected readonly convention = inject(ConventionStore).convention;
  protected readonly formatDate = formatConventionDate;
  protected readonly collapsed = signal(readCollapsed());
  private readonly accountStore = inject(AccountStore);
  protected readonly account = this.accountStore.value;
  private readonly router = inject(Router);
  private readonly errorDialog = inject(ErrorDialog);

  constructor() {
    const narrow = typeof matchMedia === 'function' ? matchMedia(NARROW) : undefined;
    if (!narrow) return;
    if (narrow.matches) this.collapsed.set(true);
    const follow = (event: MediaQueryListEvent) =>
      this.collapsed.set(event.matches || readCollapsed());
    narrow.addEventListener('change', follow);
    inject(DestroyRef).onDestroy(() => narrow.removeEventListener('change', follow));
  }

  /** Se déconnecter, puis la page de connexion. */
  protected async logOut(): Promise<void> {
    try {
      await this.accountStore.logOut();
      await this.router.navigateByUrl('/connexion');
    } catch (error) {
      const { notice } = readProblem(error);
      if (notice) void this.errorDialog.open(notice);
    }
  }

  protected toggle(): void {
    this.collapsed.update((collapsed) => !collapsed);
    storeCollapsed(this.collapsed());
  }
}
