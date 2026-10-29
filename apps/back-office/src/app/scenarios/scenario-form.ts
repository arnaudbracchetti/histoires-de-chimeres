import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  required,
  validate,
  type SchemaPath,
} from '@angular/forms/signals';
import {
  CONTENT_WARNINGS_MAX_LENGTH,
  PRESENTATION_MAX_LENGTH,
  SCENARIO_TITLE_MAX_LENGTH,
  SYSTEM_MAX_LENGTH,
  type ScenarioBody,
  type ScenarioDto,
} from '@chimeres/contract';
import { submitWith } from '../forms/submit-with';
import { textRules } from '../forms/text-rules';
import { countOf, fr, NBSP } from '@chimeres/design';
import { Field } from '../ui/field';
import { SaveButton } from '../ui/save-button';
import { PresentationPreview } from './presentation-preview';

/** La saisie : des places vides tant qu'on ne les a pas saisies, la durée en texte (boutons radio). */
type ScenarioModel = {
  title: string;
  system: string;
  presentation: string;
  contentWarnings: string;
  seats: { min: number | null; max: number | null };
  duration: '1' | '2';
};

const EMPTY: ScenarioModel = {
  title: '',
  system: '',
  presentation: '',
  contentWarnings: '',
  seats: { min: null, max: null },
  duration: '1',
};

function toModel({ title, system, presentation, contentWarnings, seats, duration }: ScenarioBody) {
  return {
    title,
    system,
    presentation,
    contentWarnings,
    seats: { ...seats },
    duration: String(duration) as ScenarioModel['duration'],
  };
}

function toBody({ seats, duration, ...content }: ScenarioModel): ScenarioBody {
  return {
    ...content,
    seats: { min: seats.min ?? 0, max: seats.max ?? 0 },
    duration: +duration as 1 | 2,
  };
}

/** Nombre de places : saisi, entier. */
function seatsRules(path: SchemaPath<number | null>, missing: string): void {
  required(path, { message: missing });
  validate(path, ({ value }) =>
    value() === null || Number.isInteger(value())
      ? undefined
      : { kind: 'not-whole', message: 'Indique un nombre entier de places.' },
  );
}

/**
 * Formulaire d'un scénario (PR-1, docs/design/patterns.md, Formulaires et Présentation) : contenu,
 * places et durée. Les erreurs locales reprennent les bornes de `contract` ; « Enregistrer » n'est
 * jamais désactivé, et le focus va au premier champ en erreur. `save` écrit le scénario et renvoie
 * celui que relit l'API ; `saved` le transmet une fois la saisie enregistrée.
 */
@Component({
  selector: 'app-scenario-form',
  imports: [Field, FormField, FormRoot, PresentationPreview, SaveButton],
  template: `
    <form [formRoot]="form">
      <app-field label="Titre" [counter]="limits.title">
        <input [formField]="form.title" autocomplete="off" />
      </app-field>
      <app-field label="Jeu" [counter]="limits.system">
        <input [formField]="form.system" autocomplete="off" />
      </app-field>
      <app-field label="Présentation" [counter]="limits.presentation" [help]="markdownHelp">
        <div class="modes" role="group" aria-label="Présentation">
          <button type="button" [attr.aria-pressed]="!previewing()" (click)="previewing.set(false)">
            Écrire
          </button>
          <button type="button" [attr.aria-pressed]="previewing()" (click)="previewing.set(true)">
            Aperçu
          </button>
        </div>
        <div class="write" [hidden]="previewing()">
          <textarea [formField]="form.presentation" rows="10"></textarea>
        </div>
        @if (previewing()) {
          <app-presentation-preview [text]="model().presentation" />
        }
      </app-field>
      <app-field label="Avertissements de contenu" optional [counter]="limits.contentWarnings">
        <textarea [formField]="form.contentWarnings" rows="2"></textarea>
      </app-field>
      <div class="seats">
        <app-field label="Places minimum" help="MJ non compris.">
          <input type="number" step="1" [formField]="form.seats.min" />
        </app-field>
        <app-field label="Places maximum">
          <input type="number" step="1" [formField]="form.seats.max" />
        </app-field>
      </div>
      <div class="duration">
        <fieldset [attr.aria-describedby]="durationError() ? 'duration-error' : null">
          <legend>Durée</legend>
          <label><input type="radio" value="1" [formField]="form.duration" /> 1&nbsp;créneau</label>
          <label
            ><input type="radio" value="2" [formField]="form.duration" /> 2&nbsp;créneaux</label
          >
        </fieldset>
        <!-- Ligne réservée, vide sans erreur : le refus de l'API n'y décale rien. -->
        <p class="error" id="duration-error">{{ durationError() }}</p>
      </div>
      <app-save-button [submitting]="form().submitting()" [savedAt]="savedAt()" />
    </form>
  `,
  styles: `
    @layer components {
      form {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        align-items: flex-start;
        max-width: 44rem;
      }

      app-field {
        align-self: stretch;
      }

      textarea {
        resize: vertical;
      }

      .write {
        display: flex;
        flex-direction: column;

        &[hidden] {
          display: none;
        }
      }

      .modes {
        display: flex;
        align-self: flex-start;
        border: 1px solid var(--border);
        border-radius: var(--radius-control);

        button {
          padding: var(--space-xxs) var(--space-s);
          border: none;
          background: none;
          color: var(--text-muted);
          cursor: pointer;

          &[aria-pressed='true'] {
            background: var(--surface-3);
            color: var(--text);
          }
        }
      }

      /* Deux lignes réservées sous chaque nombre : l'erreur ne déborde pas sur la durée. */
      .seats {
        --field-error-lines: 2;
        display: grid;
        grid-template-columns: repeat(2, 14rem);
        gap: var(--space-m);
      }

      .duration {
        margin-bottom: var(--space-m);
      }

      fieldset {
        display: flex;
        gap: var(--space-l);
        margin: 0;
        padding: 0;
        border: none;
      }

      .error {
        min-height: calc(var(--font-size-meta) * 1.4);
        margin-top: var(--space-xxs);
        color: var(--danger);
        font-size: var(--font-size-meta);
        line-height: 1.4;
      }

      legend {
        margin-bottom: var(--space-xs);
        padding: 0;
        font-weight: 600;
      }

      fieldset label {
        display: flex;
        gap: var(--space-xs);
        align-items: center;
      }
    }
  `,
})
export class ScenarioForm {
  /** Le scénario à modifier, ou rien pour en proposer un. */
  readonly scenario = input<ScenarioBody>();
  readonly save = input.required<(body: ScenarioBody) => Promise<ScenarioDto>>();
  readonly saved = output<ScenarioDto>();

  protected readonly limits = {
    title: SCENARIO_TITLE_MAX_LENGTH,
    system: SYSTEM_MAX_LENGTH,
    presentation: PRESENTATION_MAX_LENGTH,
    contentWarnings: CONTENT_WARNINGS_MAX_LENGTH,
  };
  protected readonly markdownHelp = fr`**gras**, *italique*, « - » en début de ligne pour une liste, « # » pour un intertitre, « > » pour une citation`;
  protected readonly previewing = signal(false);
  protected readonly savedAt = signal<number | undefined>(undefined);

  /** Ce qui est enregistré : la saisie en diffère tant qu'il reste des modifications. */
  private readonly snapshot = linkedSignal<ScenarioModel>(() => {
    const scenario = this.scenario();
    return scenario ? toModel(scenario) : EMPTY;
  });
  protected readonly model = linkedSignal<ScenarioModel>(() => structuredClone(this.snapshot()));

  private readonly unsaved = computed(
    () => JSON.stringify(this.model()) !== JSON.stringify(this.snapshot()),
  );

  protected readonly form = form(
    this.model,
    (path) => {
      textRules(path.title, SCENARIO_TITLE_MAX_LENGTH, {
        required: 'Donne un titre au scénario.',
        tooLong: fr`Le titre fait ${countOf(SCENARIO_TITLE_MAX_LENGTH, 'caractère', 'caractères')} au plus : raccourcis-le.`,
      });
      textRules(path.system, SYSTEM_MAX_LENGTH, {
        required: 'Indique le jeu du scénario.',
        tooLong: fr`Le jeu fait ${countOf(SYSTEM_MAX_LENGTH, 'caractère', 'caractères')} au plus : raccourcis-le.`,
      });
      textRules(path.presentation, PRESENTATION_MAX_LENGTH, {
        required: 'Présente le scénario en quelques lignes.',
        tooLong: fr`La présentation fait ${countOf(PRESENTATION_MAX_LENGTH, 'caractère', 'caractères')} au plus : raccourcis-la.`,
      });
      textRules(path.contentWarnings, CONTENT_WARNINGS_MAX_LENGTH, {
        tooLong: fr`Les avertissements de contenu font ${countOf(CONTENT_WARNINGS_MAX_LENGTH, 'caractère', 'caractères')} au plus : raccourcis-les.`,
      });
      seatsRules(path.seats.min, 'Indique le nombre minimum de places.');
      seatsRules(path.seats.max, 'Indique le nombre maximum de places.');
      validate(path.seats.min, ({ value }) => {
        const min = value();
        return min === null || min >= 1
          ? undefined
          : {
              kind: 'below-one',
              message: `Il faut au moins 1${NBSP}place.`,
            };
      });
      validate(path.seats.max, ({ value, valueOf }) => {
        const [min, max] = [valueOf(path.seats.min), value()];
        return min === null || max === null || max >= min
          ? undefined
          : {
              kind: 'out-of-order',
              message: fr`Le maximum est sous le minimum : augmente-le.`,
            };
      });
    },
    {
      // Le premier champ en erreur peut être la présentation, masquée par l'aperçu.
      submission: submitWith(() => this.write(), { beforeFocus: () => this.previewing.set(false) }),
    },
  );

  /** Le refus de la durée, que seule l'API donne : un scénario programmé la garde (PR-14). */
  protected readonly durationError = computed(() => this.form.duration().errors()[0]?.message);

  /** Vrai tant que la saisie diffère de ce qui est enregistré. */
  hasUnsavedChanges(): boolean {
    return this.unsaved();
  }

  private async write(): Promise<void> {
    const model = this.model();
    const scenario = await this.save()(toBody(model));
    this.snapshot.set(model);
    this.savedAt.set(Date.now());
    this.saved.emit(scenario);
  }
}
