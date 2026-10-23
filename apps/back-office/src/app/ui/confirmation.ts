import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { injectGesture } from '../gesture';
import { Button } from './button';

export type ConfirmationRequest = {
  /** Question qui nomme l'objet : « Supprimer le créneau 2 ? ». */
  question: string;
  /** Ce qui part avec lui : « Ses 4 disponibilités seront supprimées. » */
  consequence?: string;
  /** Bouton destructeur, qui nomme l'action : « Supprimer le créneau ». */
  confirmLabel: string;
  /** L'écriture, lancée par le bouton destructeur. Un refus s'affiche dans le dialogue. */
  action: () => Promise<unknown>;
  /** Le refus dit que l'écran est périmé : appelé à la fermeture du dialogue, pour le relire. */
  onStale?: () => void;
};

type DialogData = ConfirmationRequest & { titleId: string; markStale: () => void };

let nextId = 0;

/**
 * Dialogue de confirmation d'une action destructrice (docs/design/patterns.md, Actions
 * destructrices) : focus initial sur « Annuler ». Un refus de l'API s'affiche dans le dialogue
 * lui-même ; le bouton destructeur disparaît, il ne reste que « Fermer ».
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Button],
  host: { '[attr.aria-busy]': 'gesture.running()' },
  template: `
    <h2 [id]="request.titleId">{{ request.question }}</h2>
    @if (request.consequence) {
      <p>{{ request.consequence }}</p>
    }
    @if (refusal(); as message) {
      <p role="alert" class="refusal">{{ message }}</p>
    }
    <div class="actions">
      <button type="button" appButton="quiet" class="cancel" (click)="ref.close(false)">
        {{ refusal() ? 'Fermer' : 'Annuler' }}
      </button>
      @if (!refusal()) {
        <button type="button" appButton="danger" (click)="confirm()">
          {{ request.confirmLabel }}
        </button>
      }
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        width: 26rem;
        padding: var(--space-l) var(--space-xl);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);
      }

      /* Une question, pas un titre de section : police système. */
      h2 {
        font-family: var(--font-ui);
        font-size: var(--font-size-block);
        font-weight: 600;
      }

      .refusal {
        color: var(--danger);
      }

      .actions {
        display: flex;
        gap: var(--space-s);
        justify-content: flex-end;
      }
    }
  `,
})
export class ConfirmDialog {
  protected readonly request = inject<DialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);

  protected readonly gesture = injectGesture();
  protected readonly refusal = computed(() => this.gesture.refusal()?.message);

  protected async confirm() {
    const outcome = await this.gesture.run(this.request.action);
    if (outcome.status === 'done') this.ref.close(true);
    else if (outcome.status === 'refused' && outcome.refusal.stale) this.request.markStale();
  }
}

/**
 * Ouvre le dialogue de confirmation. À sa fermeture, le focus revient à l'élément qui l'a ouvert,
 * et un refus qui dit l'écran périmé appelle `onStale`.
 */
@Injectable({ providedIn: 'root' })
export class Confirmation {
  private readonly dialog = inject(Dialog);

  /** Résout `true` une fois l'action réussie, `false` si le dialogue se ferme sans elle. */
  async ask(request: ConfirmationRequest): Promise<boolean> {
    const titleId = `confirm-${nextId++}`;
    let stale = false;
    const data: DialogData = { ...request, titleId, markStale: () => (stale = true) };
    const ref = this.dialog.open<boolean, unknown, ConfirmDialog>(ConfirmDialog, {
      data,
      role: 'alertdialog',
      ariaLabelledBy: titleId,
      autoFocus: '.cancel',
      restoreFocus: true,
    });
    const done = (await firstValueFrom(ref.closed)) ?? false;
    if (stale) request.onStale?.();
    return done;
  }
}
