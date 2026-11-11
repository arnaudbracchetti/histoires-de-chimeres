import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, Injectable, isSignal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { injectGesture } from '../gesture';
import { Button } from './button';
import { Icon } from './icon';

/**
 * Une conséquence, un paragraphe : son texte, ou un avertissement jaune, avec son icône
 * (docs/design/patterns.md, Statuts).
 */
export type Consequence = string | { text: string; level: 'warning' };

export type ConfirmationRequest = {
  /** Question qui nomme l'objet : « Supprimer le créneau 2 ? ». */
  question: string;
  /**
   * Ce qui part avec lui, un paragraphe chacun : « Ses 4 disponibilités seront supprimées. ». Un
   * signal tient le dialogue ouvert à jour.
   */
  consequences?: readonly Consequence[] | Signal<readonly Consequence[]>;
  /** Bouton destructeur, qui nomme l'action : « Supprimer le créneau ». */
  confirmLabel: string;
  /**
   * Le bouton qui ferme, « Annuler » par défaut. Il reprend la question quand « Annuler » prêterait
   * à confusion : « Garder la partie » face à « Annuler la partie ».
   */
  cancelLabel?: string;
  /**
   * Le dessin du bouton qui confirme : rouge (destructeur, par défaut) pour ce qui efface, orange
   * (principal) pour un geste qui n'efface rien, comme lancer le tirage.
   */
  tone?: 'danger' | 'primary';
  /** L'écriture, lancée par le bouton destructeur. Un refus s'affiche dans le dialogue. */
  action: () => Promise<unknown>;
  /** Le refus dit que l'écran est périmé : appelé à la fermeture du dialogue, pour le relire. */
  onStale?: () => void;
};

type DialogData = ConfirmationRequest & { titleId: string; markStale: () => void };

let nextId = 0;

/**
 * Dialogue de confirmation d'une action destructrice, ou d'un geste qui engage (docs/design/patterns.md,
 * Actions destructrices) : focus initial sur « Annuler ». Un refus de l'API s'affiche dans le dialogue
 * lui-même ; le bouton destructeur disparaît, il ne reste que « Fermer ».
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Button, Icon],
  host: { '[attr.aria-busy]': 'gesture.running()' },
  template: `
    <h2 [id]="request.titleId">{{ request.question }}</h2>
    @for (consequence of consequences(); track $index) {
      @if (typeof consequence === 'string') {
        <p>{{ consequence }}</p>
      } @else {
        <p class="warning"><app-icon name="triangle-alert" />{{ consequence.text }}</p>
      }
    }
    @if (refusal(); as message) {
      <p role="alert" class="refusal">{{ message }}</p>
    }
    <div class="actions">
      <button type="button" appButton="quiet" class="cancel" (click)="ref.close(false)">
        {{ refusal() ? 'Fermer' : (request.cancelLabel ?? 'Annuler') }}
      </button>
      @if (!refusal()) {
        <button type="button" [appButton]="request.tone ?? 'danger'" (click)="confirm()">
          {{ request.confirmLabel }}
        </button>
      }
    </div>
  `,
  styleUrl: './dialog.css',
  styles: `
    @layer components {
      .warning {
        display: flex;
        gap: var(--space-xs);
        align-items: baseline;
        color: var(--warning);
      }
    }
  `,
})
export class ConfirmDialog {
  protected readonly request = inject<DialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly consequences = computed(() => {
    const consequences = this.request.consequences;
    return isSignal(consequences) ? consequences() : (consequences ?? []);
  });

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
