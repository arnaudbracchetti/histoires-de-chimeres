import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import type { FrontOfficeGameDto } from '@chimeres/contract';
import { countOf, fr } from '@chimeres/design';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';

/** Ce que reçoit la confirmation : la partie, et le rang de son premier créneau. */
export type OversubscribedDialogData = { game: FrontOfficeGameDto; firstRank: number };

/** Ce que rend la confirmation : rien sur « Annuler », ou si on la ferme sans choisir. */
export type OversubscribedChoice = 'sign-up' | 'see-other-games';

/**
 * « Partie très demandée » (IN-5) : avant une inscription qui laisserait la partie au-dessus de ses
 * places maximum, ou l'y ferait passer. Elle monte du bas de l'écran.
 */
@Component({
  selector: 'app-oversubscribed-dialog',
  imports: [Button, Icon],
  template: `
    <h2 id="oversubscribed-title"><app-icon name="triangle-alert" />Partie très demandée</h2>
    <p>{{ risk }}</p>
    <div class="actions">
      <button type="button" appButton="primary" (click)="ref.close('sign-up')">
        S'inscrire quand même
      </button>
      <button type="button" appButton="secondary" (click)="ref.close('see-other-games')">
        Voir les autres parties
      </button>
      <button type="button" appButton="quiet" class="cancel" (click)="ref.close()">Annuler</button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: grid;
        width: min(100vw, var(--content-width));
        gap: var(--space-m);
        padding: var(--space-xl) var(--gutter) max(env(safe-area-inset-bottom), var(--space-l));
        border: 1px solid var(--border);
        border-top-color: color-mix(in srgb, var(--warning) 70%, var(--border));
        border-bottom: none;
        border-radius: var(--radius-card) var(--radius-card) 0 0;
        background: var(--surface-3);
      }

      /* Le titre d'une confirmation, pas d'une section : police système. */
      h2 {
        display: flex;
        gap: var(--space-s);
        align-items: center;
        font-family: var(--font-ui);
        font-size: var(--font-size-mobile-section);
        font-weight: 600;
      }

      h2 app-icon {
        color: var(--warning);
      }

      .actions {
        display: grid;
        gap: var(--space-s);
      }
    }
  `,
})
export class OversubscribedDialog {
  protected readonly ref = inject<DialogRef<OversubscribedChoice>>(DialogRef);
  private readonly data = inject<OversubscribedDialogData>(DIALOG_DATA);

  protected readonly risk = describeRisk(this.data);
}

/** « *Titre* a déjà 5 inscrits pour 5 places : tu risques de ne pas avoir de place. … » (IN-5). */
function describeRisk({ game, firstRank }: OversubscribedDialogData): string {
  const signUps = countOf(game.signUpCount, 'inscrit', 'inscrits');
  const seats = countOf(game.seats.max, 'place', 'places');
  return fr`${game.title} a déjà ${signUps} pour ${seats} : tu risques de ne pas avoir de place. Inscris-toi aussi à d'autres parties du créneau ${firstRank}, pour avoir plus de chances de jouer.`;
}
