import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { fr } from '@chimeres/design';
import { readNamesakeParticipantId } from '../problem';
import { Announcer } from '../shell/announcer';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { CardForm } from './card-form';
import { nicknameRules, type NicknameOwner } from './nickname-rules';
import { submitWith } from './submit-with';

/**
 * Le pseudo, de MJ ou de participant, en place dans l'en-tête de sa fiche (ID-13,
 * docs/design/patterns.md, MJ et Fiche d'un pseudo) : « Enregistrer », ou Entrée, enregistre ;
 * « Annuler », ou Échap, ferme. Le refus s'affiche sous le champ ; un pseudo déjà pris y ajoute
 * « Voir sa fiche ». Les deux fiches renomment par la même règle du domaine : seul l'appel change.
 */
@Component({
  selector: 'app-nickname-editor',
  imports: [Button, Field, FormField, RouterLink],
  hostDirectives: [{ directive: CardForm, outputs: ['cancelled'] }],
  template: `
    <app-field [label]="label()" labelHidden [attempted]="editor.attempted()">
      <input type="text" autocomplete="off" [formField]="form.nickname" />
      @if (namesakeId(); as participantId) {
        <a appFieldErrorAction [routerLink]="['/participants', participantId]">Voir sa fiche</a>
      }
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

      [appFieldErrorAction] {
        margin-left: var(--space-xs);
        color: var(--text);
      }
    }
  `,
})
export class NicknameEditor {
  /** Le pseudo actuel, qui remplit le champ. */
  readonly nickname = input.required<string>();
  readonly owner = input.required<NicknameOwner>();
  /** Enregistre le pseudo, sans les espaces du début et de la fin ; rejette le refus de l'API. */
  readonly rename = input.required<(nickname: string) => Promise<void>>();
  /** Le pseudo est enregistré. */
  readonly saved = output<void>();

  private readonly announcer = inject(Announcer);

  protected readonly label = computed(() =>
    this.owner() === 'game-master' ? 'Pseudo du MJ' : 'Pseudo du participant',
  );

  private readonly model = linkedSignal(() => ({ nickname: this.nickname() }));

  /** Le participant qui porte déjà le pseudo refusé ; oublié dès que le pseudo change. */
  protected readonly namesakeId = linkedSignal<string, string | undefined>({
    source: () => this.model().nickname,
    computation: () => undefined,
  });

  protected readonly form = form(
    this.model,
    (path) => nicknameRules(path.nickname, () => this.owner()),
    { submission: submitWith(() => this.write()) },
  );

  protected readonly editor = inject(CardForm).attach(this.form);

  private async write(): Promise<void> {
    const nickname = this.model().nickname.trim();
    try {
      await this.rename()(nickname);
    } catch (error) {
      this.namesakeId.set(readNamesakeParticipantId(error));
      throw error;
    }
    this.announcer.announce(fr`Pseudo enregistré : ${nickname}.`);
    this.saved.emit();
  }
}
