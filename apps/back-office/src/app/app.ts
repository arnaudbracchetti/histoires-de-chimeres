import { afterNextRender, Component, ElementRef, inject, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';
import { Announcer } from './shell/announcer';
import { NotificationStack } from './shell/notification-stack';
import { Rail } from './shell/rail';

/** Coquille du back office : rail, page courante, notifications et région `aria-live`. */
@Component({
  selector: 'app-root',
  imports: [NotificationStack, Rail, RouterOutlet],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly announcer = inject(Announcer);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const injector = inject(Injector);
    // Après une navigation, le focus va au h1 de la nouvelle page. Pas au premier chargement.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() =>
        afterNextRender(() => host.querySelector<HTMLElement>('main h1')?.focus(), { injector }),
      );
  }
}
