import { DOCUMENT } from '@angular/common';
import { ApplicationRef, DestroyRef, effect, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
import { PageVisibility } from './participant-data/page-visibility';

/** Recherche d'une version tant que l'application est ouverte (§6, Mise à jour de l'application). */
const CHECK_EVERY_MS = 5 * 60_000;

/** Recharge la page, injecté pour que `AppUpdate` se teste seul. */
@Injectable({ providedIn: 'root' })
export class PageReload {
  private readonly document = inject(DOCUMENT);

  reload(): void {
    this.document.location.reload();
  }
}

/**
 * La mise à jour de l'application (ADR 0011) : elle cherche une version au lancement, au retour au
 * premier plan et toutes les 5 minutes. Une version prête s'installe sans rien demander : la page se
 * recharge à la navigation suivante (onglet, fiche), ou à défaut au retour au premier plan suivant.
 * Sans service worker (dev, tests), rien ne se passe.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdate {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly visibility = inject(PageVisibility);
  private readonly page = inject(PageReload);
  private ready = false;

  constructor() {
    const swUpdate = this.swUpdate;
    if (!swUpdate?.isEnabled) return;
    // Le service worker ne peut plus servir cette version (cache effacé) : rechargement aussitôt.
    swUpdate.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => this.page.reload());
    swUpdate.versionUpdates
      .pipe(
        filter(({ type }) => type === 'VERSION_READY'),
        takeUntilDestroyed(),
      )
      .subscribe(() => (this.ready = true));
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.installIfReady());
    this.checkInForeground();
    void this.check();
  }

  private checkInForeground(): void {
    let wasVisible = this.visibility.visible();
    effect(() => {
      const visible = this.visibility.visible();
      if (visible && !wasVisible && !this.installIfReady()) void this.check();
      wasVisible = visible;
    });
    // Comme la relecture de `ParticipantData` : la minuterie attend que l'application soit stable.
    const destroyRef = inject(DestroyRef);
    let timer: ReturnType<typeof setInterval> | undefined;
    void inject(ApplicationRef)
      .whenStable()
      .then(() => {
        if (destroyRef.destroyed) return;
        timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
      });
    destroyRef.onDestroy(() => clearInterval(timer));
  }

  private async check(): Promise<void> {
    try {
      await this.swUpdate!.checkForUpdate();
    } catch {
      // Pas de réseau : la prochaine recherche réessaiera.
    }
  }

  /** Recharge la page si une version est prête. */
  private installIfReady(): boolean {
    if (this.ready) this.page.reload();
    return this.ready;
  }
}
