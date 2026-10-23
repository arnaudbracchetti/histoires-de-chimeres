import { Component, inject, input, linkedSignal, output } from '@angular/core';
import { form, FormField, validate, type ValidationError } from '@angular/forms/signals';
import { TABLE_NAME_MAX_LENGTH, tableEndpoints, type TableDto } from '@chimeres/contract';
import { ConventionStore } from '../convention/convention-store';
import { focusFirstError, injectSubmissionFailure } from '../problem';
import { Announcer } from '../shell/announcer';
import { Button } from '../ui/button';
import { CardForm } from '../ui/card-form';
import { Field } from '../ui/field';
import { IconTile } from '../ui/icon-tile';

/**
 * Contenu d'une carte de table en saisie (docs/design/patterns.md, Tables), dans un
 * `article[appCard]` de la même taille qu'au repos : « Ajouter la table » ou « Enregistrer », ou
 * Entrée, enregistre ; « Annuler », ou Échap, ferme. L'erreur s'affiche en bulle sous la carte.
 */
@Component({
  selector: 'app-table-editor',
  imports: [Button, Field, FormField, IconTile],
  host: {
    '(keydown.enter)': 'card.onEnter($event)',
    '(keydown.escape)': 'card.onEscape($event)',
  },
  template: `
    <div class="heading">
      <app-icon-tile name="dices" />
      <app-field
        [label]="table() ? 'Nom de la table ' + table()!.name : 'Nom de la nouvelle table'"
        labelHidden
        compact
        [attempted]="card.attempted()"
      >
        <input
          type="text"
          autocomplete="off"
          placeholder="Nom de la table"
          [formField]="form.name"
        />
      </app-field>
    </div>
    <div class="buttons">
      <button type="button" appButton="primary" (click)="card.save()">
        {{ card.submitting() ? 'Enregistrement…' : table() ? 'Enregistrer' : 'Ajouter la table' }}
      </button>
      <button type="button" appButton="quiet" (click)="card.cancel()">Annuler</button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: space-between;
        min-width: 0;
      }

      .heading {
        display: flex;
        gap: var(--space-s);
        align-items: center;
      }

      app-field {
        flex: 1;
        min-width: 0;
      }

      input {
        width: 100%;
      }

      .buttons {
        display: flex;
        gap: var(--space-xs);
      }
    }
  `,
})
export class TableEditor {
  /** La table à renommer ; absente pour une nouvelle table. */
  readonly table = input<TableDto>();
  /** La table est enregistrée, et la convention partagée est à jour. */
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  private readonly store = inject(ConventionStore);
  private readonly announcer = inject(Announcer);
  private readonly failure = injectSubmissionFailure();

  private readonly model = linkedSignal(() => ({ name: this.table()?.name ?? '' }));

  protected readonly form = form(
    this.model,
    (path) => {
      // Un nom d'espaces seuls est vide, comme pour le domaine.
      validate(path.name, ({ value }) =>
        value().trim() ? undefined : { kind: 'required', message: 'Donne un nom à la table.' },
      );
      // Compté sans les espaces du début et de la fin, comme pour le domaine.
      validate(path.name, ({ value }) =>
        value().trim().length <= TABLE_NAME_MAX_LENGTH
          ? undefined
          : {
              kind: 'too-long',
              message: `Le nom d'une table fait ${TABLE_NAME_MAX_LENGTH} caractères au plus : raccourcis-le.`,
            },
      );
    },
    {
      submission: {
        action: () => this.write(),
        onInvalid: (field) => focusFirstError(field),
      },
    },
  );

  protected readonly card = new CardForm(this.form, this.cancelled);

  private async write(): Promise<ValidationError.WithFieldTree[] | undefined> {
    const name = this.model().name.trim();
    const table = this.table();
    try {
      await (table
        ? this.store.write(tableEndpoints.rename, { params: { tableId: table.id }, body: { name } })
        : this.store.write(tableEndpoints.add, { body: { name } }));
      this.announcer.announce(`Table « ${name} » enregistrée.`);
      this.saved.emit();
      return undefined;
    } catch (error) {
      return this.failure(error, this.form);
    }
  }
}
