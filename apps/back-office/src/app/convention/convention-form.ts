import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { CONVENTION_NAME_MAX_LENGTH, conventionEndpoints } from '@chimeres/contract';
import { submitWith } from '../forms/submit-with';
import { textRules } from '../forms/text-rules';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import {
  countOf,
  formatConventionDate,
  formatTime,
  formatTimeSlotRanks,
  fr,
} from '@chimeres/design';
import { Field } from '../ui/field';
import { SaveButton } from '../ui/save-button';
import { ConventionStore } from './convention-store';

/** La saisie : la date reste un texte, vide tant qu'elle n'est pas fixée (`<input type="date">`). */
type ConventionModel = { name: string; date: string };

/**
 * Renseigner la convention : son nom et sa date. Le rail suit dès l'enregistrement. Sous la date,
 * avant « Enregistrer », sa fin, calculée par l'API, et son code de présence (ID-2), qui se lisent
 * sans se modifier.
 */
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
        @if (store.convention.hasValue()) {
          <dl>
            <div>
              <dt>Fin</dt>
              <dd>
                <p class="value">{{ end().value }}</p>
                <p class="help">{{ end().help }}</p>
              </dd>
            </div>
            <div>
              <dt>Code de présence</dt>
              <dd>
                <p class="value code">{{ store.convention.value().presenceCode }}</p>
                <p class="help">Imprimé en clair sous le QR code de l'affiche.</p>
              </dd>
            </div>
          </dl>
        }
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

      app-field,
      dl {
        align-self: stretch;
      }

      dl {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        margin: 0;
      }

      dt {
        font-weight: 600;
      }

      dd {
        margin: 0;
      }

      .code {
        font-family: var(--font-caps);
        font-size: var(--font-size-section);
        letter-spacing: 0.2em;
      }

      .help {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
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
    const convention = this.store.value();
    return { name: convention?.name ?? '', date: convention?.date ?? '' };
  });

  protected readonly savedAt = signal<number | undefined>(undefined);

  /** La fin de la convention, et comment elle se calcule. */
  protected readonly end = computed(() => {
    const convention = this.store.value();
    if (!convention?.end) {
      return {
        value: 'Pas de fin',
        help: fr`Il faut une date et au moins un créneau : d'ici là, l'application des participants reste ouverte.`,
      };
    }
    const { date, time } = convention.end;
    const lastTimeSlot = formatTimeSlotRanks([convention.timeSlots.length]);
    return {
      value: `${formatConventionDate(date)} à ${formatTime(time)}`,
      help: `À la fin du dernier créneau (${lastTimeSlot}), le jour de la convention. L'application des participants se ferme alors pour tous.`,
    };
  });

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
