import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { LinkedPhone } from '../linked-phone';
import { readProblem } from '../problem';
import { fr } from '../typography/french';
import { Button } from '../ui/button';

/**
 * « Changer de pseudo ? » (ID-9) : le lien n'est coupé qu'après la confirmation. Un refus de
 * l'API s'affiche dans le dialogue lui-même.
 */
@Component({
  selector: 'app-change-nickname-dialog',
  imports: [Button],
  template: `
    <h2 id="change-nickname-title">{{ question }}</h2>
    <p>{{ consequence }}</p>
    @if (refusal(); as message) {
      <p role="alert" class="refusal">{{ message }}</p>
    }
    <div class="actions">
      <button type="button" appButton="primary" (click)="confirm()">
        {{ unlinking() ? 'Changement…' : 'Changer de pseudo' }}
      </button>
      <button type="button" appButton="secondary" class="cancel" (click)="ref.close()">
        Annuler
      </button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: grid;
        gap: var(--space-m);
        padding: var(--space-xl) var(--space-l) var(--space-l);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-3);
      }

      /* Une question, pas un titre de section : police système. */
      h2 {
        font-family: var(--font-ui);
        font-size: var(--font-size-section);
        font-weight: 600;
      }

      .refusal {
        color: var(--danger);
      }

      .actions {
        display: grid;
        gap: var(--space-s);
      }
    }
  `,
})
export class ChangeNicknameDialog {
  protected readonly ref = inject(DialogRef);
  private readonly linkedPhone = inject(LinkedPhone);
  private readonly nickname = inject<string>(DIALOG_DATA);

  protected readonly question = fr`Changer de pseudo ?`;
  protected readonly consequence = fr`Ce téléphone ne sera plus relié à ${this.nickname}. Les inscriptions de ${this.nickname} restent sous ce pseudo : pour les retrouver, il faudra le retaper.`;
  protected readonly unlinking = signal(false);
  protected readonly refusal = signal<string | null>(null);

  protected async confirm(): Promise<void> {
    if (this.unlinking()) return;
    this.unlinking.set(true);
    this.refusal.set(null);
    try {
      await this.linkedPhone.unlink();
      this.ref.close();
    } catch (error) {
      const { alert, fieldErrors } = readProblem(error);
      this.refusal.set(
        alert ? [alert.title, alert.detail].filter(Boolean).join(' ') : fieldErrors[0]!.message,
      );
    } finally {
      this.unlinking.set(false);
    }
  }
}
