import { Dialog } from '@angular/cdk/dialog';
import { createFlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import {
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';
import { LinkedPhone } from '../linked-phone';
import { NotificationsBanner } from '../notifications/notifications-banner';
import { ParticipantData } from '../participant-data/participant-data';
import { Icon } from '../ui/icon';
import { ChangeNicknameDialog } from './change-nickname-dialog';
import { NicknameBox, type NicknameBoxResult } from './nickname-box';
import { TabNavigation, TABS } from './tab-navigation';

/**
 * La coquille du front office : en haut, l'emblème, « Histoires de Chimères » et le pseudo ; en
 * bas, les trois onglets. Sous l'en-tête, le bandeau de NO-6, tant que le téléphone ne reçoit
 * pas les notifications. Un tap sur le pseudo ouvre sa boîte, avec « Changer de pseudo ». La
 * fiche d'une partie (`sheet`) prend tout l'écran. Les données du participant vivent avec elle :
 * sous l'en-tête, la ligne d'âge dit de quand elles datent, et un tap les relit. À la fin de la
 * convention, la coquille s'efface (`ended`).
 */
@Component({
  selector: 'app-shell',
  imports: [Icon, NotificationsBanner, RouterOutlet],
  providers: [ParticipantData],
  template: `
    @if (sheet()) {
      <router-outlet />
    } @else {
      <header>
        <svg class="emblem" aria-hidden="true" focusable="false">
          <use href="emblem.svg#emblem-small" />
        </svg>
        <span class="brand">Histoires de Chimères</span>
        <button
          #nicknameButton
          type="button"
          class="nickname"
          aria-haspopup="dialog"
          [attr.aria-expanded]="boxOpen()"
          (click)="openBox()"
        >
          <app-icon name="user-round" />
          <span>{{ linkedPhone.nickname() }}</span>
        </button>
      </header>
      <app-notifications-banner />
      @if (data.ageLine(); as line) {
        <button type="button" class="age-line" (click)="data.reread()">{{ line }}</button>
      }
      <main>
        <router-outlet />
      </main>
      <nav aria-label="Navigation principale">
        @for (tab of tabs; track tab.path) {
          <a
            [href]="'/' + tab.path"
            [attr.aria-current]="navigation.current() === tab.path ? 'page' : null"
            (click)="$event.preventDefault(); navigation.go(tab.path)"
          >
            <app-icon [name]="tab.icon" />
            <span>{{ tab.label }}</span>
          </a>
        }
      </nav>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
      }

      header {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        gap: var(--space-s);
        align-items: center;
        min-height: var(--bar-height);
        padding: var(--space-xs) var(--space-s) var(--space-xs) var(--gutter);
        border-bottom: 1px solid var(--border);
        background: var(--surface-1);
      }

      .emblem {
        width: 28px;
        height: 28px;
        flex: none;
      }

      .brand {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        font-family: var(--font-display);
        font-size: var(--font-size-mobile-body);
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nickname {
        display: inline-flex;
        flex: none;
        gap: var(--space-xs);
        align-items: center;
        max-width: 150px;
        min-height: var(--touch-target);
        padding: 0 var(--space-m) 0 var(--space-s);
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface-3);
        color: var(--text);
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
        cursor: pointer;

        span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        app-icon {
          color: var(--text-muted);
        }

        &[aria-expanded='true'] {
          border-color: var(--accent);
          color: var(--accent);
        }
      }

      .age-line {
        min-height: var(--touch-target);
        padding: var(--space-xs) var(--gutter);
        border: none;
        border-bottom: 1px solid var(--border);
        background: var(--surface-2);
        color: var(--text-muted);
        font: inherit;
        font-size: var(--font-size-mobile-meta);
        text-align: start;
        cursor: pointer;
      }

      main {
        flex: 1;
        width: 100%;
        max-width: var(--content-width);
        margin-inline: auto;
        padding: var(--gutter);
      }

      nav {
        position: sticky;
        bottom: 0;
        display: grid;
        grid-auto-columns: 1fr;
        grid-auto-flow: column;
        border-top: 1px solid var(--border);
        background: var(--surface-1);
      }

      nav a {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        align-items: center;
        justify-content: center;
        min-height: var(--bar-height);
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
        text-decoration: none;

        &[aria-current='page'] {
          color: var(--accent);
        }
      }
    }
  `,
})
export class Shell {
  protected readonly linkedPhone = inject(LinkedPhone);
  protected readonly navigation = inject(TabNavigation);
  protected readonly tabs = TABS;
  protected readonly boxOpen = signal(false);
  protected readonly data = inject(ParticipantData);
  /** La convention est terminée, selon l'heure du téléphone ou le serveur. */
  readonly ended = output<void>();

  private readonly router = inject(Router);
  /** L'écran affiché prend tout l'écran, sans en-tête ni onglets : la fiche d'une partie. */
  protected readonly sheet = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => isSheet(this.router.routerState.snapshot.root)),
    ),
    { initialValue: isSheet(this.router.routerState.snapshot.root) },
  );

  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);
  private readonly nicknameButton = viewChild.required<ElementRef<HTMLElement>>('nicknameButton');

  constructor() {
    void this.navigation.recreateHomeBelow();
    effect(() => {
      if (this.data.ended()) this.ended.emit();
    });
  }

  /** La boîte du pseudo, sous son bouton ; « Changer de pseudo » y ouvre la confirmation. */
  protected async openBox(): Promise<void> {
    const nickname = this.linkedPhone.nickname();
    const box = this.dialog.open<NicknameBoxResult, string, NicknameBox>(NicknameBox, {
      data: nickname,
      ariaLabel: 'Ton pseudo',
      backdropClass: 'scrim',
      restoreFocus: true,
      positionStrategy: createFlexibleConnectedPositionStrategy(
        this.injector,
        this.nicknameButton(),
      ).withPositions([{ originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' }]),
    });
    this.boxOpen.set(true);
    const result = await firstValueFrom(box.closed);
    this.boxOpen.set(false);
    if (result !== 'change') return;
    this.dialog.open(ChangeNicknameDialog, {
      data: nickname,
      role: 'alertdialog',
      ariaLabelledBy: 'change-nickname-title',
      autoFocus: '.cancel',
      backdropClass: 'scrim',
      restoreFocus: true,
    });
  }
}

function isSheet(route: ActivatedRouteSnapshot): boolean {
  return !!route.data['sheet'] || route.children.some(isSheet);
}
