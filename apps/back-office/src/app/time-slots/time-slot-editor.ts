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
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { timeSlotEndpoints, type TimeSlotDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { ConventionStore } from '../convention/convention-store';
import { focusFirstError, readProblem, toSubmissionErrors } from '../problem';
import { Announcer } from '../shell/announcer';
import { Notifications } from '../shell/notifications';
import { Button } from '../ui/button';
import { formatDuration, minutesOf, normalizeTime, timeOf, timeSlotLabel } from './time-format';

/** Durée habituelle d'un créneau : la fin d'un nouveau créneau est proposée d'après elle. */
const USUAL_DURATION_MINUTES = 150;
const LAST_MINUTE = 24 * 60 - 1;

type HoursModel = { start: string; end: string };

let nextId = 0;

/**
 * Carte d'un créneau en saisie (docs/design/patterns.md, Créneaux) : « Ajouter le créneau » ou
 * « Enregistrer », ou Entrée, enregistre ; « Annuler », ou Échap, ferme. Un nouveau créneau
 * commence à `proposedStart`, et sa fin est proposée 2 h 30 après le début tant qu'on ne l'a pas
 * saisie. Les heures se saisissent sur 24 heures. Chaque erreur a sa ligne réservée sous son champ.
 */
@Component({
  selector: 'article[appTimeSlotEditor]',
  imports: [Button, FormField],
  host: {
    '[attr.aria-labelledby]': "id + '-title'",
    '(keydown.enter)': 'onEnter($event)',
    '(keydown.escape)': '$event.preventDefault(); cancel()',
  },
  template: `
    <p class="mode">Saisie en cours</p>
    <h3 [id]="id + '-title'">
      {{ timeSlot() ? 'Modifier le créneau ' + timeSlot()!.rank : 'Nouveau créneau' }}
    </h3>
    <div class="fields">
      <div class="field">
        <label [for]="id + '-start'">Début</label>
        <input
          #start
          [id]="id + '-start'"
          type="text"
          placeholder="hh:mm"
          autocomplete="off"
          [formField]="form.start"
          (input)="proposeEnd($any($event.target).value)"
          [attr.aria-invalid]="!!startError()"
          [attr.aria-describedby]="startError() ? id + '-start-error' : null"
        />
        <p class="error" [id]="id + '-start-error'">{{ startError() }}</p>
      </div>
      <div class="field">
        <label [for]="id + '-end'">Fin</label>
        <input
          [id]="id + '-end'"
          type="text"
          placeholder="hh:mm"
          autocomplete="off"
          [formField]="form.end"
          (input)="endEntered = true"
          [attr.aria-invalid]="!!endError()"
          [attr.aria-describedby]="endError() ? id + '-end-error' : null"
        />
        <p class="error" [id]="id + '-end-error'">{{ endError() }}</p>
      </div>
      <p class="duration">{{ duration() || '—' }}</p>
    </div>
    <div class="buttons">
      <button type="button" appButton="primary" (click)="save()">
        {{ submitting() ? 'Enregistrement…' : timeSlot() ? 'Enregistrer' : 'Ajouter le créneau' }}
      </button>
      <button type="button" appButton="quiet" (click)="cancel()">Annuler</button>
    </div>
  `,
  styles: `
    @layer components {
      .mode {
        color: var(--accent);
        font-size: var(--font-size-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h3 {
        font-size: var(--font-size-block);
      }

      .fields {
        display: flex;
        gap: var(--space-l);
        align-items: flex-start;
      }

      /* Le bas du champ réserve la ligne de son erreur. */
      .field {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding-bottom: calc(var(--font-size-meta) * 1.4);
      }

      label {
        font-weight: 600;
      }

      input {
        width: 7rem;
        font-variant-numeric: tabular-nums;
      }

      /* Dans la ligne réservée, sans élargir le champ : l'erreur qui apparaît ne décale rien. */
      .error {
        position: absolute;
        bottom: 0;
        left: 0;
        color: var(--danger);
        font-size: var(--font-size-meta);
        white-space: nowrap;
      }

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
  readonly cancelled = output<void>();

  private readonly store = inject(ConventionStore);
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly injector = inject(Injector);
  private readonly startInput = viewChild.required<ElementRef<HTMLInputElement>>('start');
  protected readonly id = `time-slot-editor-${nextId++}`;

  private readonly model = linkedSignal<HoursModel>(() => {
    const timeSlot = this.timeSlot();
    if (timeSlot) return { start: timeSlot.start, end: timeSlot.end };
    const start = this.proposedStart();
    return { start, end: proposedEndOf(start) };
  });

  private readonly notifications = inject(Notifications);
  /** Un enregistrement a été tenté : une heure manquante se signale dès lors, pas avant. */
  private readonly attempted = signal(false);
  /** Un enregistrement est en cours, de l'appel à `submit()` jusqu'à sa réponse. */
  private saving = false;
  /** Pendant l'envoi, « Enregistrer » passe en « Enregistrement… ». */
  readonly submitting = computed(() => this.form().submitting());

  protected readonly form = form(
    this.model,
    (path) => {
      required(path.start, { message: "Indique l'heure de début." });
      required(path.end, { message: "Indique l'heure de fin." });
      for (const time of [path.start, path.end]) {
        validate(time, ({ value }) =>
          !value() || normalizeTime(value())
            ? undefined
            : { kind: 'time', message: "Écris l'heure sur 24\u00a0heures, de 00:00 à 23:59." },
        );
      }
      validate(path.end, ({ value, valueOf }) => {
        const start = normalizeTime(valueOf(path.start));
        const end = normalizeTime(value());
        if (!start || !end || end > start) return undefined;
        return {
          kind: 'end-not-after-start',
          message: "La fin du créneau vient après son début\u00a0: change l'une des deux heures.",
        };
      });
    },
    {
      submission: {
        action: () => this.write(),
        onInvalid: (field) => focusFirstError(field),
      },
    },
  );

  protected readonly startError = computed(() => this.errorOf(this.form.start()));
  protected readonly endError = computed(() => this.errorOf(this.form.end()));

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

  constructor() {
    afterNextRender(() => this.startInput().nativeElement.focus());
  }

  /** Fin proposée 2 h 30 après le début, pour un nouveau créneau, tant qu'on ne l'a pas saisie. */
  protected proposeEnd(text: string) {
    if (this.timeSlot() || this.endEntered || !normalizeTime(text)) return;
    this.form.end().value.set(proposedEndOf(text));
  }

  /** Entrée dans un champ enregistre ; sur un bouton, elle ne fait que le cliquer. */
  protected onEnter(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    this.save();
  }

  /** Enregistre le créneau : Entrée, ou le bouton principal de la carte. */
  save() {
    this.attempted.set(true);
    this.saving = true;
    void submit(this.form).finally(() => (this.saving = false));
  }

  /**
   * Ferme la saisie sans rien enregistrer : Échap, ou « Annuler ». Sans effet pendant un
   * enregistrement, qui serait sinon perdu.
   */
  cancel() {
    if (this.saving) return;
    this.cancelled.emit();
  }

  /**
   * L'erreur d'un champ quitté. Une heure manquante attend la tentative d'enregistrement : quitter
   * un champ vide pour cliquer « Annuler » n'affiche rien.
   */
  private errorOf(state: {
    touched(): boolean;
    errors(): readonly { kind: string; message?: string }[];
  }) {
    if (!state.touched()) return undefined;
    return state.errors().find(({ kind }) => kind !== 'required' || this.attempted())?.message;
  }

  private async write() {
    // Le formulaire est valide : les deux heures se lisent.
    const body = this.hours() as { start: string; end: string };
    const timeSlot = this.timeSlot();
    try {
      const convention = timeSlot
        ? await this.apiCall(timeSlotEndpoints.changeHours, {
            params: { timeSlotId: timeSlot.id },
            body,
          })
        : await this.apiCall(timeSlotEndpoints.add, { body });
      this.store.convention.set(convention);
      const saved = convention.timeSlots.find(({ start }) => start === body.start);
      if (saved) this.announcer.announce(`${timeSlotLabel(saved)}, enregistré.`);
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

/** Fin proposée 2 h 30 après un début lisible, ou rien. */
function proposedEndOf(startText: string): string {
  const start = normalizeTime(startText);
  if (!start) return '';
  const end = minutesOf(start) + USUAL_DURATION_MINUTES;
  return end <= LAST_MINUTE ? timeOf(end) : '';
}
