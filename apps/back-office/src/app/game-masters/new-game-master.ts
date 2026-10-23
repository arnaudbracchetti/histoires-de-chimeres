import { Component, inject, output, signal } from '@angular/core';
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
 * Ligne « Nouveau MJ » en bas du tableau des MJ (docs/design/patterns.md, MJ) : « Ajouter », ou
 * Entrée, crée le MJ ; « Annuler », ou Échap, ferme. La ligne est la dernière du tableau : son
 * erreur s'affiche en bulle juste dessous, sans rien couvrir ni décaler.
 */
@Component({
  selector: 'app-new-game-master',
  imports: [Button, Field, FormField],
  host: {
    '(keydown.enter)': 'row.onEnter($event)',
    '(keydown.escape)': 'row.onEscape($event)',
  },
  template: `
    <app-field label="Pseudo du nouveau MJ" labelHidden compact [attempted]="row.attempted()">
      <input type="text" autocomplete="off" placeholder="Nouveau MJ" [formField]="form.nickname" />
    </app-field>
    <button type="button" appButton="primary" (click)="row.save()">
      {{ row.submitting() ? 'Enregistrement…' : 'Ajouter' }}
    </button>
    <button type="button" appButton="quiet" (click)="row.cancel()">Annuler</button>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        gap: var(--space-s);
        align-items: center;
      }

      app-field {
        flex: 1;
      }

      input {
        width: 100%;
      }
    }
  `,
})
export class NewGameMaster {
  /** Le MJ est créé : la liste relue, dans l'ordre naturel. */
  readonly added = output<GameMasterDto[]>();
  readonly cancelled = output<void>();

  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly failure = injectSubmissionFailure();

  private readonly model = signal({ nickname: '' });

  protected readonly form = form(this.model, (path) => nicknameRules(path.nickname), {
    submission: {
      action: () => this.write(),
      onInvalid: (field) => focusFirstError(field),
    },
  });

  protected readonly row = new CardForm(this.form, this.cancelled);

  private async write(): Promise<ValidationError.WithFieldTree[] | undefined> {
    const nickname = this.model().nickname.trim();
    try {
      const gameMasters = await this.apiCall(gameMasterEndpoints.add, { body: { nickname } });
      this.announcer.announce(`MJ « ${nickname} » ajouté.`);
      this.added.emit(gameMasters);
      return undefined;
    } catch (error) {
      return this.failure(error, this.form);
    }
  }
}
