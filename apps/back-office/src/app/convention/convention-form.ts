import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal,
} from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
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
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { IconTile } from '../ui/icon-tile';
import { ConventionStore } from './convention-store';

/** La saisie : la date reste un texte, vide tant qu'elle n'est pas fixée (`<input type="date">`). */
type ConventionModel = { name: string; date: string };

/**
 * La carte de la convention (docs/design/patterns.md, Convention). En lecture : son nom et sa date,
 * puis sa fin, calculée par l'API, et son code de présence (ID-2), avec un lien vers les
 * Informations de connexion et le QR code. « Modifier » la retourne en saisie du nom et de la date ;
 * l'enregistrement la referme, et le rail suit. « Annuler », ou Échap, la referme sans rien envoyer.
 */
@Component({
  selector: 'app-convention-form',
  imports: [Button, Card, Field, FormField, FormRoot, IconTile, Loadable, RouterLink],
  template: `
    <app-loadable [resource]="store.convention" failure="Impossible de charger la convention.">
      @if (store.convention.value(); as convention) {
        @if (editing()) {
          <article appCard editing (keydown.escape)="cancel()">
            <form [formRoot]="form">
              <p class="mode">Saisie en cours</p>
              <h3>Modifier la convention</h3>
              <div class="fields">
                <app-field label="Nom">
                  <input #name [formField]="form.name" autocomplete="off" />
                </app-field>
                <app-field
                  label="Date"
                  optional
                  help="Laisse-la vide tant qu'elle n'est pas fixée."
                >
                  <input type="date" [formField]="form.date" />
                </app-field>
              </div>
              <div class="buttons">
                <button type="submit" appButton="primary">
                  {{ form().submitting() ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
                <button type="button" appButton="quiet" (click)="cancel()">Annuler</button>
              </div>
            </form>
          </article>
        } @else {
          <article appCard tabindex="-1" cardId="convention" aria-labelledby="convention-name">
            <header>
              <app-icon-tile name="calendar" />
              <div class="identity">
                <h3 id="convention-name">{{ convention.name }}</h3>
                <p class="date">{{ formatDate(convention.date) }}</p>
              </div>
              <button
                type="button"
                appButton="secondary"
                aria-label="Modifier la convention"
                (click)="edit()"
              >
                Modifier
              </button>
            </header>
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
                  <p class="value code">{{ convention.presenceCode }}</p>
                  <p class="help">
                    <a routerLink="/informations-de-connexion">
                      Imprimé en clair sous le QR code de l'affiche.
                    </a>
                  </p>
                </dd>
              </div>
            </dl>
          </article>
        }
      }
    </app-loadable>
  `,
  styles: `
    @layer components {
      /* En lecture : l'identité de la convention en tête, puis, sous un filet, ce qui se lit sans
         se modifier, en deux colonnes. */
      .card {
        flex-direction: column;
        padding: var(--space-l) var(--space-xl);
      }

      .card.editing {
        padding: var(--space-m) var(--space-l);
      }

      header {
        display: flex;
        gap: var(--space-m);
        align-items: center;
        padding-bottom: var(--space-l);
        border-bottom: 1px solid var(--border);
      }

      .identity {
        flex: 1;
        min-width: 0;
      }

      h3 {
        font-size: var(--font-size-block);
      }

      .date,
      .help {
        color: var(--text-muted);
      }

      dl {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: var(--space-xxl);
        margin: 0;
        padding-top: var(--space-l);
      }

      dl > div {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      dt {
        color: var(--text-muted);
        font-size: var(--font-size-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      dd {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        margin: 0;
      }

      .value {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .code {
        font-family: var(--font-caps);
        font-size: var(--font-size-section);
        font-weight: normal;
        letter-spacing: 0.2em;
      }

      .help {
        max-width: 34rem;
        font-size: var(--font-size-meta);
      }

      form {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
      }

      .mode {
        color: var(--accent);
        font-size: var(--font-size-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .fields {
        display: grid;
        grid-template-columns: minmax(0, 24rem) 12rem;
        gap: var(--space-l);
        align-items: start;
      }

      .buttons {
        display: flex;
        gap: var(--space-s);
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

  /** La carte de la convention est en saisie. */
  protected readonly editing = signal(false);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected edit(): void {
    this.editing.set(true);
    this.focusAfterRender('input');
  }

  /** Abandonne la saisie : le modèle repart de la convention lue. */
  protected cancel(): void {
    const convention = this.store.value();
    this.model.set({ name: convention?.name ?? '', date: convention?.date ?? '' });
    this.close();
  }

  private close(): void {
    this.editing.set(false);
    this.focusAfterRender('article.card');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  /** La fin de la convention, et comment elle se calcule. */
  protected readonly end = computed(() => {
    const convention = this.store.value();
    if (!convention?.end) {
      return {
        value: 'Pas de fin',
        help: fr`Sans date, la convention n'a pas de fin : l'application mobile reste ouverte aux participants.`,
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
        tooLong: fr`Le nom de la convention ne doit pas dépasser ${countOf(CONVENTION_NAME_MAX_LENGTH, 'caractère', 'caractères')} : raccourcis-le.`,
      }),
    { submission: submitWith(() => this.save()) },
  );

  private async save(): Promise<void> {
    const { name, date } = this.model();
    await this.store.write(conventionEndpoints.update, { body: { name, date: date || null } });
    this.close();
    this.announcer.announce('Convention enregistrée.');
  }
}
