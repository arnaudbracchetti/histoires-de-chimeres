import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, Injectable, signal } from '@angular/core';
import type { CreatedAccessLinkDto } from '@chimeres/contract';
import { formatLocalMoment, fr } from '@chimeres/design';
import { QrCode } from '../poster/qr-code';
import { Button } from '../ui/button';

type DialogData = { link: CreatedAccessLinkDto; nickname: string; titleId: string };

let nextId = 0;

/**
 * Le lien d'accès qu'un Organisateur vient de créer (ID-6, ADR 0018), à remettre de vive voix ou
 * par message : en QR code et en texte, avec « Copier le lien ». L'URL n'est montrée qu'ici, une
 * seule fois : l'API ne la redonne pas.
 */
@Component({
  selector: 'app-access-link-dialog',
  imports: [Button, QrCode],
  styleUrl: '../ui/dialog.css',
  template: `
    <h2 [id]="data.titleId">Lien d'accès de «&nbsp;{{ data.nickname }}&nbsp;»</h2>
    <p>{{ handOver }}</p>
    <div class="link">
      <app-qr-code [url]="data.link.url" label="QR code du lien d'accès" />
      <div class="side">
        <input
          type="text"
          readonly
          aria-label="Lien d'accès"
          [value]="data.link.url"
          (focus)="$any($event.target).select()"
        />
        <button type="button" appButton="secondary" (click)="copy()">
          {{ copied() ? 'Lien copié' : 'Copier le lien' }}
        </button>
        <p class="meta">{{ validity }}</p>
      </div>
    </div>
    <div class="actions">
      <button type="button" appButton="primary" class="close" (click)="ref.close()">Fermer</button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        width: 36rem;
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
    }
  `,
})
export class AccessLinkDialogView {
  protected readonly data = inject<DialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly copied = signal(false);
  protected readonly handOver = fr`Remets ce lien à « ${this.data.nickname} », de vive voix ou par message. Il ouvre la page où choisir son mot de passe.`;
  protected readonly validity = fr`Valable jusqu'au ${formatLocalMoment(this.data.link.expiresAt)}, une seule fois. Créer un autre lien annule celui-ci.`;

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.data.link.url);
    this.copied.set(true);
  }
}

/** Ouvre le dialogue du lien créé ; la promesse se résout à sa fermeture. */
@Injectable({ providedIn: 'root' })
export class AccessLinkDialog {
  private readonly dialog = inject(Dialog);

  async show(link: CreatedAccessLinkDto, nickname: string): Promise<void> {
    const titleId = `access-link-${nextId++}`;
    const ref = this.dialog.open(AccessLinkDialogView, {
      data: { link, nickname, titleId },
      ariaLabelledBy: titleId,
      autoFocus: '.close',
      restoreFocus: true,
    });
    await new Promise<void>((closed) => ref.closed.subscribe(() => closed()));
  }
}
