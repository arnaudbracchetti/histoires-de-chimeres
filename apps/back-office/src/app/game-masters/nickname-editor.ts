import { Component, inject, input, linkedSignal, output } from '@angular/core';
import { form, FormField, type ValidationError } from '@angular/forms/signals';
import { gameMasterEndpoints, type GameMasterDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { focusFirstError, injectSubmissionFailure } from '../problem';
import { Announcer } from '../shell/announcer';
import { Button } from '../ui/button';
import { CardForm } from '../ui/card-form';
import { Field } from '../ui/field';
import { nicknameRules } from './nickname';

/**
 * Le pseudo d'un MJ, en place dans l'en-tête de sa fiche (docs/design/patterns.md, MJ) :
 * « Enregistrer », ou Entrée, enregistre ; « Annuler », ou Échap, ferme. Le refus s'affiche sous
 * le champ.
 */
@Component({
  selector: 'app-nickname-editor',
  imports: [Button, Field, FormField],
  host: {
    '(keydown.enter)': 'editor.onEnter($event)',
    '(keydown.escape)': 'editor.onEscape($event)',
  },
  template: `
    <app-field label="Pseudo du MJ" labelHidden [attempted]="editor.attempted()">
      <input type="text" autocomplete="off" [formField]="form.nickname" />
    </app-field>
    <button type="button" appButton="primary" (click)="editor.save()">
      {{ editor.submitting() ? 'Enregistrement…' : 'Enregistrer' }}
    </button>
    <button type="button" appButton="quiet" (click)="editor.cancel()">Annuler</button>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
      }

      app-field {
        width: 20rem;
        --field-error-white-space: nowrap;
      }

      input {
        width: 100%;
        font-size: var(--font-size-section);
      }
    }
  `,
})
export class NicknameEditor {
  readonly gameMaster = input.required<GameMasterDto>();
  /** Le pseudo est enregistré : la fiche relue. */
  readonly saved = output<GameMasterDto>();
  readonly cancelled = output<void>();

  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly failure = injectSubmissionFailure();

  private readonly model = linkedSignal(() => ({ nickname: this.gameMaster().nickname }));

  protected readonly form = form(this.model, (path) => nicknameRules(path.nickname), {
    submission: {
      action: () => this.write(),
      onInvalid: (field) => focusFirstError(field),
    },
  });

  protected readonly editor = new CardForm(this.form, this.cancelled);

  private async write(): Promise<ValidationError.WithFieldTree[] | undefined> {
    const nickname = this.model().nickname.trim();
    try {
      const gameMaster = await this.apiCall(gameMasterEndpoints.rename, {
        params: { gameMasterId: this.gameMaster().id },
        body: { nickname },
      });
      this.announcer.announce(`Pseudo enregistré : ${nickname}.`);
      this.saved.emit(gameMaster);
      return undefined;
    } catch (error) {
      return this.failure(error, this.form);
    }
  }
}
