import { Component, inject, output, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { gameMasterEndpoints, type GameMasterDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { CardForm } from '../forms/card-form';
import { submitWith } from '../forms/submit-with';
import { Announcer } from '../shell/announcer';
import { Button } from '../ui/button';
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
  hostDirectives: [{ directive: CardForm, outputs: ['cancelled'] }],
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

  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);

  private readonly model = signal({ nickname: '' });

  protected readonly form = form(this.model, (path) => nicknameRules(path.nickname), {
    submission: submitWith(() => this.write()),
  });

  protected readonly row = inject(CardForm).attach(this.form);

  private async write(): Promise<void> {
    const nickname = this.model().nickname.trim();
    const gameMasters = await this.apiCall(gameMasterEndpoints.add, { body: { nickname } });
    this.announcer.announce(`MJ « ${nickname} » ajouté.`);
    this.added.emit(gameMasters);
  }
}
