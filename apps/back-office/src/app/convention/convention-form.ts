import { Component, inject, linkedSignal, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { CONVENTION_NAME_MAX_LENGTH, conventionEndpoints } from '@chimeres/contract';
import { submitWith } from '../forms/submit-with';
import { textRules } from '../forms/text-rules';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { formatConventionDate } from '../typography/date';
import { countOf, fr } from '../typography/french';
import { Field } from '../ui/field';
import { SaveButton } from '../ui/save-button';
import { ConventionStore } from './convention-store';

/** La saisie : la date reste un texte, vide tant qu'elle n'est pas fixée (`<input type="date">`). */
type ConventionModel = { name: string; date: string };

/** Renseigner la convention : son nom et sa date. Le rail suit dès l'enregistrement. */
@Component({
  selector: 'app-convention-form',
  imports: [Field, FormField, FormRoot, Loadable, SaveButton],
  template: `
    <app-loadable [resource]="store.convention" failure="Impossible de charger la convention.">
      @if (store.convention.hasValue()) {
        <p class="date">{{ formatDate(store.convention.value().date) }}</p>
      }
      <form [formRoot]="form">
        <app-field label="Nom">
          <input [formField]="form.name" autocomplete="off" />
        </app-field>
        <app-field label="Date" optional help="Laisse-la vide tant qu'elle n'est pas fixée.">
          <input type="date" [formField]="form.date" />
        </app-field>
        <app-save-button [submitting]="form().submitting()" [savedAt]="savedAt()" />
      </form>
    </app-loadable>
  `,
  styles: `
    @layer components {
      .date {
        margin-bottom: var(--space-m);
        color: var(--text-muted);
      }

      form {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        align-items: flex-start;
        max-width: 32rem;
      }

      app-field {
        align-self: stretch;
      }
    }
  `,
})
export class ConventionForm {
  protected readonly store = inject(ConventionStore);
  protected readonly formatDate = formatConventionDate;
  private readonly announcer = inject(Announcer);

  /** Repart de la convention lue, et de celle que renvoie chaque enregistrement. */
  private readonly model = linkedSignal<ConventionModel>(() => {
    const convention = this.store.convention.hasValue() ? this.store.convention.value() : undefined;
    return { name: convention?.name ?? '', date: convention?.date ?? '' };
  });

  protected readonly savedAt = signal<number | undefined>(undefined);

  protected readonly form = form(
    this.model,
    (path) =>
      textRules(path.name, CONVENTION_NAME_MAX_LENGTH, {
        required: 'Donne un nom à la convention.',
        tooLong: fr`Le nom fait ${countOf(CONVENTION_NAME_MAX_LENGTH, 'caractère', 'caractères')} au plus : raccourcis-le.`,
      }),
    { submission: submitWith(() => this.save()) },
  );

  private async save(): Promise<void> {
    const { name, date } = this.model();
    await this.store.write(conventionEndpoints.update, { body: { name, date: date || null } });
    this.savedAt.set(Date.now());
    this.announcer.announce('Convention enregistrée.');
  }
}
