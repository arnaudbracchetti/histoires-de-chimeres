import { Component, inject, input } from '@angular/core';
import { fr } from '@chimeres/design';
import { PresenceCodeStore } from '../presence-code-store';

/**
 * Le pense-bête de l'iPhone avant l'ajout à l'écran d'accueil : l'application installée ne reçoit
 * ni le code de présence ni le pseudo tapé dans le navigateur, qu'on y retape. Sans code reçu par le
 * QR code, il dit seulement où le trouver.
 */
@Component({
  selector: 'app-retype-reminder',
  template: `
    <div class="reminder">
      @if (presenceCode() || nickname()) {
        <span class="over">{{ nickname() ? "Dans l'application, tu retaperas" : "L'application te demandera ce code" }}</span>
        <dl>
          @if (presenceCode()) {
            <dt>Code de présence</dt>
            <dd class="code">{{ presenceCode() }}</dd>
          }
          @if (nickname()) {
            <dt>Ton pseudo</dt>
            <dd>{{ nickname() }}</dd>
          }
        </dl>
      } @else {
        <span class="over">L'application te demandera le code de présence</span>
      }
      <p class="meta">{{ presenceCode() ? ifForgotten : whereToFind }}</p>
    </div>
  `,
  styles: `
    @layer components {
      .reminder {
        display: grid;
        gap: var(--space-s);
        padding: var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);
        text-align: start;
      }

      dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--space-xs) var(--space-m);
        align-items: baseline;
        margin: 0;
      }

      dt {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }

      dd {
        margin: 0;
        font-weight: 600;
      }

      .code {
        letter-spacing: 0.15em;
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }
    }
  `,
})
export class RetypeReminder {
  /** Le pseudo déjà tapé dans le navigateur, à retaper dans l'application. */
  readonly nickname = input<string | null>(null);

  protected readonly presenceCode = inject(PresenceCodeStore).code;
  protected readonly ifForgotten = fr`Si tu l'oublies, le code est écrit sous le QR code, sur l'affiche de l'accueil.`;
  protected readonly whereToFind = fr`Il est écrit sous le QR code, sur l'affiche de l'accueil.`;
}
