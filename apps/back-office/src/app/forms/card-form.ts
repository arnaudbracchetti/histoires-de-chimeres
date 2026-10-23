import {
  afterNextRender,
  computed,
  Directive,
  ElementRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { submit, type FieldTree } from '@angular/forms/signals';

/**
 * Comportement d'une carte en saisie (docs/design/patterns.md, Formulaires), par `hostDirectives`
 * en exposant `cancelled` : focus sur le premier champ à l'ouverture ; Entrée dans un champ
 * enregistre, Échap ferme ; une valeur manquante n'est signalée qu'après une tentative
 * (`attempted`, à passer aux `app-field`) ; pendant l'envoi, Échap et « Annuler » sont sans effet.
 * La carte y relie son formulaire : `inject(CardForm).attach(this.form)`.
 */
@Directive({
  selector: '[appCardForm]',
  host: {
    '(keydown.enter)': 'onEnter($event)',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class CardForm {
  /** Fermée sans rien enregistrer : Échap, ou « Annuler ». */
  readonly cancelled = output<void>();
  /** Un enregistrement a été tenté : une valeur manquante se signale dès lors, pas avant. */
  readonly attempted = signal(false);
  /** Pendant l'envoi, le bouton principal passe en « Enregistrement… ». */
  readonly submitting = computed(() => this.form()?.().submitting() ?? false);

  private readonly form = signal<FieldTree<unknown> | undefined>(undefined);
  /** Un enregistrement est en cours, de l'appel à `submit()` jusqu'à sa réponse. */
  private saving = false;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => host.querySelector('input')?.focus());
  }

  /** Relie le formulaire de la carte, celui que `save()` envoie. */
  attach(form: FieldTree<unknown>): this {
    this.form.set(form);
    return this;
  }

  /** Enregistre : Entrée dans un champ, ou le bouton principal de la carte. */
  save(): void {
    const form = this.form();
    if (!form) return;
    this.attempted.set(true);
    this.saving = true;
    void submit(form).finally(() => (this.saving = false));
  }

  /** Ferme sans rien enregistrer : Échap, ou « Annuler ». Sans effet pendant un enregistrement. */
  cancel(): void {
    if (this.saving) return;
    this.cancelled.emit();
  }

  /** Entrée dans un champ enregistre ; sur un bouton, elle ne fait que le cliquer. */
  protected onEnter(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    this.save();
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    this.cancel();
  }
}
