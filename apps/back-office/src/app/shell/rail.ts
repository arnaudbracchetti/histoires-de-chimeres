import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ConventionStore } from '../convention/convention-store';
import { formatConventionDate } from '../convention/convention-date';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Loadable } from './loadable';

/** Clé de l'état replié, mémorisé par navigateur. */
const COLLAPSED_KEY = 'back-office.rail-collapsed';

/** Sous cette largeur, le rail se replie de lui-même (docs/design/patterns.md). */
const NARROW = '(max-width: 1279.98px)';

type Entry = { label: string; icon: string; link: string };

const PREPARATION: readonly Entry[] = [
  { label: 'Calendrier', icon: 'calendar', link: '/' },
  { label: 'MJ', icon: 'users', link: '/mj' },
  { label: 'Scénarios', icon: 'book-open', link: '/scenarios' },
  { label: 'Créneaux et tables', icon: 'layout-grid', link: '/creneaux-et-tables' },
];

const DAY_OF: readonly Omit<Entry, 'link'>[] = [
  { label: 'Pilotage du jour J', icon: 'radio-tower' },
  { label: 'Participants', icon: 'user-round' },
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
 * masqué à l'écran, et sert d'infobulle et de nom accessible.
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

  constructor() {
    const narrow = typeof matchMedia === 'function' ? matchMedia(NARROW) : undefined;
    if (!narrow) return;
    if (narrow.matches) this.collapsed.set(true);
    const follow = (event: MediaQueryListEvent) =>
      this.collapsed.set(event.matches || readCollapsed());
    narrow.addEventListener('change', follow);
    inject(DestroyRef).onDestroy(() => narrow.removeEventListener('change', follow));
  }

  protected toggle(): void {
    this.collapsed.update((collapsed) => !collapsed);
    storeCollapsed(this.collapsed());
  }
}
