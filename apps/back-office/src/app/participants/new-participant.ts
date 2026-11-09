import { Component, inject, linkedSignal, output, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { participantEndpoints, type ParticipantSheetDto } from '@chimeres/contract';
import { fr } from '@chimeres/design';
import { injectApiCall } from '../api-call';
import { CardForm } from '../forms/card-form';
import { nicknameRules } from '../forms/nickname-rules';
import { submitWith } from '../forms/submit-with';
import { readNamesakeParticipantId } from '../problem';
import { Announcer } from '../shell/announcer';
import { Button } from '../ui/button';
import { Field } from '../ui/field';

/**
 * Ligne « Nouveau pseudo » en bas de la liste « Participants » (ID-12, docs/design/patterns.md,
 * Participants) : « Créer », ou Entrée, crée le pseudo ; « Annuler », ou Échap, ferme. La ligne est
 * la dernière du tableau : son erreur s'affiche en bulle juste dessous, sans rien couvrir ni
 * décaler. Un pseudo déjà pris, de participant ou de MJ, y ajoute « Voir sa fiche ».
 */
@Component({
  selector: 'app-new-participant',
  imports: [Button, Field, FormField, RouterLink],
  hostDirectives: [{ directive: CardForm, outputs: ['cancelled'] }],
  template: `
    <app-field
      label="Pseudo du nouveau participant"
      labelHidden
      compact
      [attempted]="row.attempted()"
    >
      <input
        type="text"
        autocomplete="off"
        placeholder="Nouveau pseudo"
        [formField]="form.nickname"
      />
      @if (namesakeId(); as participantId) {
        <a appFieldErrorAction [routerLink]="['/participants', participantId]">Voir sa fiche</a>
      }
    </app-field>
    <button type="button" appButton="primary" (click)="row.save()">
      {{ row.submitting() ? 'Enregistrement…' : 'Créer' }}
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

      [appFieldErrorAction] {
        margin-left: var(--space-xs);
        color: var(--text);
      }
    }
  `,
})
export class NewParticipant {
  /** Le pseudo est créé : sa fiche. */
  readonly added = output<ParticipantSheetDto>();

  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);

  private readonly model = signal({ nickname: '' });

  /** Le participant qui porte déjà le pseudo refusé ; oublié dès que le pseudo change. */
  protected readonly namesakeId = linkedSignal<string, string | undefined>({
    source: () => this.model().nickname,
    computation: () => undefined,
  });

  protected readonly form = form(
    this.model,
    (path) => nicknameRules(path.nickname, 'participant'),
    { submission: submitWith(() => this.write()) },
  );

  protected readonly row = inject(CardForm).attach(this.form);

  private async write(): Promise<void> {
    const nickname = this.model().nickname.trim();
    try {
      const sheet = await this.apiCall(participantEndpoints.add, { body: { nickname } });
      this.announcer.announce(fr`Pseudo « ${sheet.nickname} » créé.`);
      this.added.emit(sheet);
    } catch (error) {
      this.namesakeId.set(readNamesakeParticipantId(error));
      throw error;
    }
  }
}
