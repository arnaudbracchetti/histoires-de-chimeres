import { Component, computed, input, signal } from '@angular/core';
import type { CreatedAccessLinkDto } from '@chimeres/contract';
import { formatLocalMoment, fr } from '@chimeres/design';
import { QrCode } from '../poster/qr-code';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';

/**
 * Le lien d'accès qu'un Organisateur vient de créer (ID-6, ADR 0018), à remettre de vive voix ou
 * par message : en QR code et en texte, avec « Copier le lien ». L'URL n'est montrée qu'ici, une
 * seule fois : l'API ne la redonne pas, et un avertissement jaune le dit. Repris par le dialogue du lien et par l'assistant « Créer
 * un pseudo ».
 */
@Component({
  selector: 'app-access-link-hand-over',
  imports: [Button, Icon, QrCode],
  template: `
    <p>{{ handOver() }}</p>
    <div class="link">
      <app-qr-code [url]="link().url" label="QR code du lien d'accès" />
      <div class="side">
        <input
          type="text"
          readonly
          aria-label="Lien d'accès"
          [value]="link().url"
          (focus)="$any($event.target).select()"
        />
        <button type="button" appButton="secondary" (click)="copy()">
          {{ copied() ? 'Lien copié' : 'Copier le lien' }}
        </button>
        <p class="meta">{{ validity() }}</p>
      </div>
    </div>
    <div class="once" role="note">
      <app-icon name="triangle-alert" />
      <div>
        <p class="once-title">{{ onceTitle }}</p>
        <p class="meta">{{ onceDetail }}</p>
      </div>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      p {
        margin: 0;
      }

      .link {
        display: flex;
        gap: var(--space-m);
        align-items: flex-start;
      }

      app-qr-code {
        width: 9rem;
        flex: none;
      }

      .side {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: var(--space-s);
        align-items: flex-start;
        min-width: 0;
      }

      input {
        width: 100%;
        font-size: var(--font-size-meta);
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .once {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
      }

      .once app-icon,
      .once-title {
        color: var(--warning);
      }

      .once app-icon {
        padding-block-start: 0.2em;
      }
    }
  `,
})
export class AccessLinkHandOver {
  readonly link = input.required<CreatedAccessLinkDto>();
  /** Le pseudo du compte, tel qu'il s'affiche. */
  readonly nickname = input.required<string>();

  protected readonly copied = signal(false);
  protected readonly handOver = computed(
    () =>
      fr`Remets ce lien à « ${this.nickname()} », de vive voix ou par message. Il ouvre la page où choisir son mot de passe.`,
  );
  protected readonly validity = computed(
    () =>
      fr`Valable jusqu'au ${formatLocalMoment(this.link().expiresAt)}, une seule fois. Créer un autre lien annule celui-ci.`,
  );

  protected readonly onceTitle = fr`Attention : ce lien ne s'affichera plus une fois cette fenêtre fermée.`;
  protected readonly onceDetail = fr`Copie-le ou fais scanner le QR code maintenant. Sinon, il faudra créer un nouveau lien, qui annulera celui-ci.`;

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.link().url);
    this.copied.set(true);
  }
}
