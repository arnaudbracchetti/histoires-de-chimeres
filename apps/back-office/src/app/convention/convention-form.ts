import { afterNextRender, Component, inject, Injector, linkedSignal, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, required } from '@angular/forms/signals';
import { CONVENTION_NAME_MAX_LENGTH, conventionEndpoints } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { focusFirstError, readProblem, toSubmissionErrors } from '../problem';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { Notifications } from '../shell/notifications';
import { Field } from '../ui/field';
import { SaveButton } from '../ui/save-button';
import { formatConventionDate } from './convention-date';
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
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly notifications = inject(Notifications);
  private readonly injector = inject(Injector);

  /** Repart de la convention lue, et de celle que renvoie chaque enregistrement. */
  private readonly model = linkedSignal<ConventionModel>(() => {
    const convention = this.store.convention.hasValue() ? this.store.convention.value() : undefined;
    return { name: convention?.name ?? '', date: convention?.date ?? '' };
  });

  protected readonly savedAt = signal<number | undefined>(undefined);

  protected readonly form = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Donne un nom à la convention.' });
      maxLength(path.name, CONVENTION_NAME_MAX_LENGTH, {
        message: `Le nom fait ${CONVENTION_NAME_MAX_LENGTH} caractères au plus\u00a0: raccourcis-le.`,
      });
    },
    {
      submission: {
        action: () => this.save(),
        onInvalid: (field) => focusFirstError(field),
      },
    },
  );

  private async save() {
    const { name, date } = this.model();
    try {
      const convention = await this.apiCall(conventionEndpoints.update, {
        body: { name, date: date || null },
      });
      this.store.convention.set(convention);
      this.savedAt.set(Date.now());
      this.announcer.announce('Convention enregistrée.');
      return undefined;
    } catch (error) {
      const { errors, alert } = toSubmissionErrors(readProblem(error), this.form);
      if (alert) this.notifications.error(alert);
      afterNextRender(() => focusFirstError(this.form), { injector: this.injector });
      return errors;
    }
  }
}
