import { Dialog } from '@angular/cdk/dialog';
import { createGlobalPositionStrategy } from '@angular/cdk/overlay';
import { Component, computed, inject, Injector } from '@angular/core';
import { fr } from '@chimeres/design';
import { Icon } from '../ui/icon';
import { ActivationGuide } from './activation-guide';
import { PushNotifications } from './push-notifications';

/**
 * Le bandeau de NO-6, sous l'en-tête, tant que le téléphone ne reçoit pas les notifications. Il ne
 * se ferme pas. Un tap ouvre le guide d'activation, sauf quand le téléphone ne peut rien recevoir.
 */
@Component({
  selector: 'app-notifications-banner',
  imports: [Icon],
  template: `
    @switch (push.status()) {
      @case ('unsupported') {
        <p class="banner" role="status">
          <app-icon name="triangle-alert" />
          <span>{{ unsupported }}</span>
        </p>
      }
      @case ('granted') {}
      @default {
        <button type="button" class="banner" (click)="openGuide()">
          <app-icon name="bell-off" />
          <span>{{ text() }}</span>
          <app-icon name="chevron-right" class="chevron" />
        </button>
      }
    }
  `,
  styles: `
    @layer components {
      .banner {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
        width: 100%;
        min-height: var(--touch-target);
        margin: 0;
        padding: var(--space-s) var(--gutter);
        border: none;
        border-bottom: 1px solid var(--border);
        background: color-mix(in srgb, var(--warning) 14%, var(--surface-1));
        color: var(--text);
        font: inherit;
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
        text-align: start;
      }

      button.banner {
        cursor: pointer;
      }

      app-icon {
        color: var(--warning);
      }

      span {
        flex: 1;
      }

      .chevron {
        color: var(--text-muted);
      }
    }
  `,
})
export class NotificationsBanner {
  protected readonly push = inject(PushNotifications);
  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);

  protected readonly unsupported = fr`Ce téléphone ne reçoit pas les notifications : reviens voir ta table ici après chaque tirage`;
  protected readonly text = computed(() =>
    this.push.status() === 'denied'
      ? fr`Notifications bloquées : réactive-les dans les réglages pour connaître ta table`
      : 'Active les notifications pour connaître ta table',
  );

  protected openGuide(): void {
    this.dialog.open(ActivationGuide, {
      ariaLabelledBy: 'activation-guide-title',
      backdropClass: 'scrim',
      restoreFocus: true,
      positionStrategy: createGlobalPositionStrategy(this.injector)
        .bottom('0')
        .centerHorizontally(),
    });
  }
}
