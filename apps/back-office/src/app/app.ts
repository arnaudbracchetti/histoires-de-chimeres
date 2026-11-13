import { afterNextRender, Component, ElementRef, inject, Injector } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, skip } from 'rxjs';
import { isPageWithoutSession } from './account/pages-without-session';
import { Announcer } from './shell/announcer';
import { Rail } from './shell/rail';

/**
 * Coquille du back office : rail, page courante et région `aria-live`. La page de
 * connexion et celle d'un lien d'accès se passent du rail.
 */
@Component({
  selector: 'app-root',
  imports: [Rail, RouterOutlet],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly announcer = inject(Announcer);
  private readonly router = inject(Router);
  protected readonly withRail = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => !isPageWithoutSession(this.router.url)),
    ),
    // Sans rail avant la première navigation : sur une page sans session, il lirait la convention
    // sans session (401), et le store partagé garderait cet échec après la connexion.
    { initialValue: false },
  );

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const injector = inject(Injector);
    // Après une navigation, le focus va au h1 de la nouvelle page. Pas au premier chargement.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() =>
        afterNextRender(() => host.querySelector<HTMLElement>('main h1')?.focus(), { injector }),
      );
  }
}
