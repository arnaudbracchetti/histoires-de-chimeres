import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { timeSlotEndpoints, type TimeSlotDto } from '@chimeres/contract';
import { ConventionStore } from '../convention/convention-store';
import { CardForm } from '../forms/card-form';
import { submitWith } from '../forms/submit-with';
import { Announcer } from '../shell/announcer';
import {
  formatDuration,
  fr,
  timeOf,
  timeSlotLabel,
  minutesOf,
  NBSP,
  normalizeTime,
} from '@chimeres/design';
import { Button } from '../ui/button';
import { Field } from '../ui/field';

/** Durée habituelle d'un créneau : la fin d'un nouveau créneau est proposée d'après elle. */
const USUAL_DURATION_MINUTES = 150;
const LAST_MINUTE = 24 * 60 - 1;

type HoursModel = { start: string; end: string };

let nextId = 0;

/**
 * Contenu d'une carte de créneau en saisie (docs/design/patterns.md, Créneaux), dans un
 * `article[appCard]` : « Ajouter le créneau » ou « Enregistrer », ou Entrée, enregistre ;
 * « Annuler », ou Échap, ferme. Un nouveau créneau commence à `proposedStart`, et sa fin est
 * proposée 2 h 30 après le début tant qu'on ne l'a pas saisie. Les heures se saisissent sur
 * 24 heures. Chaque erreur a sa ligne réservée sous son champ.
 */
@Component({
  selector: 'app-time-slot-editor',
  imports: [Button, Field, FormField],
  host: {
    role: 'group',
    '[attr.aria-labelledby]': "id + '-title'",
  },
  hostDirectives: [{ directive: CardForm, outputs: ['cancelled'] }],
  template: `
    <p class="mode">Saisie en cours</p>
    <h3 [id]="id + '-title'">
      {{ timeSlot() ? 'Modifier le créneau ' + timeSlot()!.rank : 'Nouveau créneau' }}
    </h3>
    <div class="fields">
      <app-field label="Début" [attempted]="card.attempted()">
        <input
          type="text"
          placeholder="hh:mm"
          autocomplete="off"
          [formField]="form.start"
          (input)="proposeEnd($any($event.target).value)"
        />
      </app-field>
      <app-field label="Fin" [attempted]="card.attempted()">
        <input
          type="text"
          placeholder="hh:mm"
          autocomplete="off"
          [formField]="form.end"
          (input)="endEntered = true"
        />
      </app-field>
      <p class="duration">{{ duration() || '—' }}</p>
    </div>
    <div class="buttons">
      <button type="button" appButton="primary" (click)="card.save()">
        {{
          card.submitting() ? 'Enregistrement…' : timeSlot() ? 'Enregistrer' : 'Ajouter le créneau'
        }}
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
        gap: var(--space-s);
      }

      .mode {
        color: var(--accent);
        font-size: var(--font-size-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h3 {
        font-size: var(--font-size-block);
      }

      /* Deux colonnes égales, et deux lignes réservées : les messages passent à la ligne sans
         déborder sur le champ voisin. */
      .fields {
        --field-error-lines: 2;

        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: var(--space-l);
        align-items: start;
      }

      input {
        width: 7rem;
        font-variant-numeric: tabular-nums;
      }

      /* À la hauteur des champs, sous leur libellé. */
      .duration {
        padding-top: 1.6rem;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }

      .buttons {
        display: flex;
        gap: var(--space-s);
      }
    }
  `,
})
export class TimeSlotEditor {
  /** Le créneau à modifier ; absent pour un nouveau créneau. */
  readonly timeSlot = input<TimeSlotDto>();
  /** Début proposé pour un nouveau créneau : la fin du dernier. */
  readonly proposedStart = input('');
  /** Le créneau est enregistré, et la convention partagée est à jour. */
  readonly saved = output<void>();

  private readonly store = inject(ConventionStore);
  private readonly announcer = inject(Announcer);
  protected readonly id = `time-slot-editor-${nextId++}`;

  private readonly model = linkedSignal<HoursModel>(() => {
    const timeSlot = this.timeSlot();
    if (timeSlot) return { start: timeSlot.start, end: timeSlot.end };
    const start = this.proposedStart();
    return { start, end: proposedEndOf(start) };
  });

  protected readonly form = form(
    this.model,
    (path) => {
      required(path.start, { message: "Indique l'heure de début." });
      required(path.end, { message: "Indique l'heure de fin." });
      for (const time of [path.start, path.end]) {
        validate(time, ({ value }) =>
          !value() || normalizeTime(value())
            ? undefined
            : { kind: 'time', message: `Écris l'heure sur 24${NBSP}heures, de 00:00 à 23:59.` },
        );
      }
      validate(path.end, ({ value, valueOf }) => {
        const start = normalizeTime(valueOf(path.start));
        const end = normalizeTime(value());
        if (!start || !end || end > start) return undefined;
        return {
          kind: 'end-not-after-start',
          message: fr`La fin du créneau vient après son début : change l'une des deux heures.`,
        };
      });
    },
    {
      submission: submitWith(() => this.write()),
    },
  );

  protected readonly card = inject(CardForm).attach(this.form);

  /** Les heures saisies, en `HH:MM`, si ce sont des heures. */
  private readonly hours = computed(() => ({
    start: normalizeTime(this.model().start),
    end: normalizeTime(this.model().end),
  }));

  protected readonly duration = computed(() => {
    const { start, end } = this.hours();
    return start && end && end > start ? formatDuration(start, end) : '';
  });

  /** La fin a été saisie : elle n'est plus proposée. */
  protected endEntered = false;

  /** Fin proposée 2 h 30 après le début, pour un nouveau créneau, tant qu'on ne l'a pas saisie. */
  protected proposeEnd(text: string) {
    if (this.timeSlot() || this.endEntered || !normalizeTime(text)) return;
    this.form.end().value.set(proposedEndOf(text));
  }

  private async write(): Promise<void> {
    // Le formulaire est valide : les deux heures se lisent.
    const body = this.hours() as HoursModel;
    const timeSlot = this.timeSlot();
    const convention = timeSlot
      ? await this.store.write(timeSlotEndpoints.changeHours, {
          params: { timeSlotId: timeSlot.id },
          body,
        })
      : await this.store.write(timeSlotEndpoints.add, { body });
    const saved = convention.timeSlots.find(({ start }) => start === body.start);
    if (saved) this.announcer.announce(`${timeSlotLabel(saved)}, enregistré.`);
    this.saved.emit();
  }
}

/** Fin proposée 2 h 30 après un début lisible, ou rien. */
function proposedEndOf(startText: string): string {
  const start = normalizeTime(startText);
  if (!start) return '';
  const end = minutesOf(start) + USUAL_DURATION_MINUTES;
  return end <= LAST_MINUTE ? timeOf(end) : '';
}
