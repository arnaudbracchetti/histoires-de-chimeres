import { Location } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, type Params, Router } from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';

/** Un onglet de la barre du bas : son chemin, sans `/` (`''` pour l'Accueil). */
export type Tab = { path: string; label: string; icon: string };

export const TABS: readonly Tab[] = [
  { path: '', label: 'Accueil', icon: 'house' },
  { path: 'programme', label: 'Programme', icon: 'calendar' },
  { path: 'mes-parties', label: 'Mes parties', icon: 'dices' },
];

const HOME = '';

/** Marque, dans l'historique, une entrée posée sur l'Accueil. */
const ABOVE_HOME = 'aboveHome';

/**
 * L'historique des onglets : l'Accueil en est la racine, un onglet se pose dessus, et changer
 * d'onglet ne s'empile pas. Le retour du téléphone remonte donc d'un écran : onglet → Accueil →
 * sortie.
 */
@Injectable({ providedIn: 'root' })
export class TabNavigation {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Le chemin affiché, sans `/`. */
  readonly current = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.currentPath()),
    ),
    { initialValue: this.currentPath() },
  );

  /**
   * Depuis l'Accueil, l'onglet s'empile ; depuis un onglet, il le remplace ; l'Accueil se retrouve
   * en reculant. `queryParams` y choisit ce qu'il montre (le créneau du programme).
   */
  go(path: string, queryParams?: Params): void {
    const current = this.currentPath();
    if (path === current) return;
    if (path === HOME) {
      this.location.back();
      return;
    }
    void this.router.navigate([`/${path}`], {
      queryParams,
      replaceUrl: current !== HOME,
      state: { [ABOVE_HOME]: true },
    });
  }

  /**
   * Une application ouverte sur un autre écran que l'Accueil (lien d'une notification) n'a rien
   * dessous : l'Accueil y est recréé, et l'écran posé dessus.
   */
  async recreateHomeBelow(): Promise<void> {
    if (!this.router.navigated) {
      await firstValueFrom(
        this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
      );
    }
    const state = this.location.getState() as Record<string, unknown> | null;
    if (this.currentPath() === HOME || state?.[ABOVE_HOME]) return;
    const url = this.router.url;
    await this.router.navigateByUrl('/', { replaceUrl: true });
    await this.router.navigateByUrl(url, { state: { [ABOVE_HOME]: true } });
  }

  private currentPath(): string {
    const primary = this.router.parseUrl(this.router.url).root.children['primary'];
    return primary?.segments.map(({ path }) => path).join('/') ?? HOME;
  }
}
