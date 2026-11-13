import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, Injectable } from '@angular/core';
import type { CreatedAccessLinkDto } from '@chimeres/contract';
import { Button } from '../ui/button';
import { AccessLinkHandOver } from './access-link-hand-over';

type DialogData = { link: CreatedAccessLinkDto; nickname: string; titleId: string };

let nextId = 0;

/** Le dialogue du lien d'accès créé depuis l'onglet « Compte » de la fiche d'un pseudo. */
@Component({
  selector: 'app-access-link-dialog',
  imports: [AccessLinkHandOver, Button],
  styleUrl: '../ui/dialog.css',
  template: `
    <h2 [id]="data.titleId">Lien d'accès de «&nbsp;{{ data.nickname }}&nbsp;»</h2>
    <app-access-link-hand-over [link]="data.link" [nickname]="data.nickname" />
    <div class="actions">
      <button type="button" appButton="primary" class="close" (click)="ref.close()">Fermer</button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        width: 36rem;
      }
    }
  `,
})
export class AccessLinkDialogView {
  protected readonly data = inject<DialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
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
