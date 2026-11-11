import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Button } from '../ui/button';

/** Une erreur hors formulaire : le `title` et le `detail` d'un Problem Details, affichés tels quels. */
export type ErrorNotice = {
  title: string;
  detail?: string;
};

type DialogData = ErrorNotice & { titleId: string };

let nextId = 0;

/**
 * Le dialogue d'une erreur (docs/design/patterns.md, Erreur hors formulaire), dessiné comme le refus
 * dans un dialogue de confirmation : le motif, la phrase en rouge brique, et « Fermer ».
 */
@Component({
  selector: 'app-error-dialog',
  imports: [Button],
  styleUrl: '../ui/dialog.css',
  template: `
    <h2 [id]="notice.titleId">{{ notice.title }}</h2>
    @if (notice.detail) {
      <p class="refusal">{{ notice.detail }}</p>
    }
    <div class="actions">
      <button type="button" appButton="quiet" class="close" (click)="ref.close()">Fermer</button>
    </div>
  `,
})
export class ErrorDialogView {
  protected readonly notice = inject<DialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
}

type Pending = { notice: ErrorNotice; closed: () => void };

/**
 * Les erreurs hors formulaire du back office, chacune dans un dialogue modal qui reste ouvert
 * jusqu'à « Fermer » ou Échap ; le focus revient alors à l'élément d'avant. Plusieurs erreurs
 * s'affichent l'une après l'autre, dans leur ordre d'arrivée.
 */
@Injectable({ providedIn: 'root' })
export class ErrorDialog {
  private readonly dialog = inject(Dialog);
  private readonly queue = signal<readonly Pending[]>([]);
  /** Le service est détruit (fin de l'application, ou d'un test) : plus aucun dialogue ne s'ouvre. */
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  /** Les erreurs affichée et en attente, la première à l'écran. */
  pending(): ErrorNotice[] {
    return this.queue().map(({ notice }) => notice);
  }

  /** Montre l'erreur ; la promesse se résout à la fermeture de son dialogue. */
  open(notice: ErrorNotice): Promise<void> {
    return new Promise((closed) => {
      this.queue.update((queue) => [...queue, { notice, closed }]);
      if (this.queue().length === 1) void this.showFirst();
    });
  }

  private async showFirst(): Promise<void> {
    const first = this.queue()[0];
    if (!first || this.destroyed) return;
    const titleId = `error-${nextId++}`;
    const ref = this.dialog.open(ErrorDialogView, {
      data: { ...first.notice, titleId },
      role: 'alertdialog',
      ariaLabelledBy: titleId,
      autoFocus: '.close',
      restoreFocus: true,
    });
    await firstValueFrom(ref.closed);
    this.queue.update((queue) => queue.slice(1));
    first.closed();
    void this.showFirst();
  }
}
