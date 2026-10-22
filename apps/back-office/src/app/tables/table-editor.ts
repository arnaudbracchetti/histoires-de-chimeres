import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { TABLE_NAME_MAX_LENGTH, tableEndpoints, type TableDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { ConventionStore } from '../convention/convention-store';
import { focusFirstError, readProblem, toSubmissionErrors } from '../problem';
import { Announcer } from '../shell/announcer';
import { Notifications } from '../shell/notifications';
import { Button } from '../ui/button';
import { IconTile } from '../ui/icon-tile';

let nextId = 0;

/**
 * Carte d'une table en saisie (docs/design/patterns.md, Tables), de la même taille qu'une carte au
 * repos : « Ajouter la table » ou « Enregistrer », ou Entrée, enregistre ; « Annuler », ou Échap,
 * ferme. L'erreur s'affiche dans une bulle sous la carte, par-dessus : elle ne décale rien.
 */
@Component({
  selector: 'article[appTableEditor]',
  imports: [Button, FormField, IconTile],
  host: {
    class: 'editing',
    '(keydown.enter)': 'onEnter($event)',
    '(keydown.escape)': '$event.preventDefault(); cancel()',
  },
  template: `
    <div class="heading">
      <app-icon-tile name="dices" />
      <input
        #name
        type="text"
        autocomplete="off"
        placeholder="Nom de la table"
        [attr.aria-label]="
          table() ? 'Nom de la table ' + table()!.name : 'Nom de la nouvelle table'
        "
        [formField]="form.name"
        [attr.aria-invalid]="!!error()"
        [attr.aria-describedby]="error() ? id + '-error' : null"
      />
    </div>
    <div class="buttons">
      <button type="button" appButton="primary" (click)="save()">
        {{ submitting() ? 'Enregistrement…' : table() ? 'Enregistrer' : 'Ajouter la table' }}
      </button>
      <button type="button" appButton="quiet" (click)="cancel()">Annuler</button>
    </div>
    @if (error()) {
      <p class="error" [id]="id + '-error'">{{ error() }}</p>
    }
  `,
  styles: `
    @layer components {
      .heading {
        display: flex;
        gap: var(--space-s);
        align-items: center;
      }

      input {
        flex: 1;
        width: 100%;
        min-width: 0;
      }

      .buttons {
        display: flex;
        gap: var(--space-xs);
      }

      /* Bulle sous la carte, par-dessus : l'erreur qui apparaît ne décale rien. */
      .error {
        position: absolute;
        top: calc(100% + var(--space-xxs));
        left: 0;
        z-index: 2;
        padding: var(--space-xs) var(--space-s);
        border: 1px solid var(--danger);
        border-radius: var(--radius-control);
        background: var(--surface-2);
        color: var(--danger);
        font-size: var(--font-size-meta);
        white-space: nowrap;
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
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly notifications = inject(Notifications);
  private readonly injector = inject(Injector);
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('name');
  protected readonly id = `table-editor-${nextId++}`;

  private readonly model = linkedSignal(() => ({ name: this.table()?.name ?? '' }));
  /** Un enregistrement a été tenté : un nom manquant se signale dès lors, pas avant. */
  private readonly attempted = signal(false);
  /** Un enregistrement est en cours, de l'appel à `submit()` jusqu'à sa réponse. */
  private saving = false;
  /** Pendant l'envoi, « Enregistrer » passe en « Enregistrement… ». */
  readonly submitting = computed(() => this.form().submitting());

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

  /**
   * L'erreur du champ quitté. Un nom manquant attend la tentative d'enregistrement : quitter un
   * champ vide pour cliquer « Annuler » n'affiche rien.
   */
  protected readonly error = computed(() => {
    const state = this.form.name();
    if (!state.touched()) return undefined;
    return state.errors().find(({ kind }) => kind !== 'required' || this.attempted())?.message;
  });

  constructor() {
    afterNextRender(() => this.nameInput().nativeElement.focus());
  }

  /** Entrée dans le champ enregistre. */
  protected onEnter(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    this.save();
  }

  save() {
    this.attempted.set(true);
    this.saving = true;
    void submit(this.form).finally(() => (this.saving = false));
  }

  /** Ferme la saisie sans rien enregistrer. Sans effet pendant un enregistrement, qui serait sinon perdu. */
  cancel() {
    if (this.saving) return;
    this.cancelled.emit();
  }

  private async write() {
    const name = this.model().name.trim();
    const table = this.table();
    try {
      const convention = table
        ? await this.apiCall(tableEndpoints.rename, {
            params: { tableId: table.id },
            body: { name },
          })
        : await this.apiCall(tableEndpoints.add, { body: { name } });
      this.store.convention.set(convention);
      this.announcer.announce(`Table « ${name} » enregistrée.`);
      this.saved.emit();
      return undefined;
    } catch (error) {
      const { errors, alert } = toSubmissionErrors(readProblem(error), this.form);
      if (alert) this.notifications.error(alert);
      afterNextRender(() => focusFirstError(this.form), { injector: this.injector });
      return errors;
    }
  }
}
