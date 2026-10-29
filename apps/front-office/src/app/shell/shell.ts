import { Dialog } from '@angular/cdk/dialog';
import { createFlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { Component, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LinkedPhone } from '../linked-phone';
import { Icon } from '../ui/icon';
import { ChangeNicknameDialog } from './change-nickname-dialog';
import { NicknameBox, type NicknameBoxResult } from './nickname-box';
import { TabNavigation, TABS } from './tab-navigation';

/**
 * La coquille du front office : en haut, l'emblème, « Histoires de Chimères » et le pseudo ; en
 * bas, les trois onglets. Un tap sur le pseudo ouvre sa boîte, avec « Changer de pseudo ».
 */
@Component({
  selector: 'app-shell',
  imports: [Icon, RouterOutlet],
  template: `
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
        min-height: 56px;
        padding: var(--space-xs) var(--space-s) var(--space-xs) var(--space-l);
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
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nickname {
        display: inline-flex;
        flex: none;
        gap: var(--space-xs);
        align-items: center;
        max-width: 150px;
        min-height: 44px;
        padding: 0 var(--space-m) 0 var(--space-s);
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface-3);
        color: var(--text);
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

      main {
        flex: 1;
        width: 100%;
        max-width: 480px;
        margin-inline: auto;
        padding: var(--space-l);
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
        min-height: 56px;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
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

  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);
  private readonly nicknameButton = viewChild.required<ElementRef<HTMLElement>>('nicknameButton');

  constructor() {
    void this.navigation.recreateHomeBelow();
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
      ).withPositions([
        { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
      ]),
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
      width: 'calc(100vw - 32px)',
      maxWidth: '448px',
      restoreFocus: true,
    });
  }
}
