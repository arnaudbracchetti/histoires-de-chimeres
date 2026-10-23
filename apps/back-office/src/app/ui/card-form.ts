import {
  afterNextRender,
  computed,
  ElementRef,
  inject,
  signal,
  type OutputEmitterRef,
} from '@angular/core';
import { submit, type FieldTree } from '@angular/forms/signals';

/**
 * Comportement d'une carte en saisie (docs/design/patterns.md, Formulaires) : focus sur le premier
 * champ à l'ouverture ; Entrée dans un champ enregistre, Échap ferme ; une valeur manquante n'est
 * signalée qu'après une tentative (`attempted`, à passer aux `app-field`) ; pendant l'envoi, Échap
 * et « Annuler » sont sans effet. À créer dans un champ du composant, après son formulaire.
 */
export class CardForm {
  /** Un enregistrement a été tenté : une valeur manquante se signale dès lors, pas avant. */
  readonly attempted = signal(false);
  /** Pendant l'envoi, le bouton principal passe en « Enregistrement… ». */
  readonly submitting = computed(() => this.form().submitting());
  /** Un enregistrement est en cours, de l'appel à `submit()` jusqu'à sa réponse. */
  private saving = false;

  constructor(
    private readonly form: FieldTree<unknown>,
    private readonly cancelled: OutputEmitterRef<void>,
  ) {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => host.querySelector('input')?.focus());
  }

  /** Enregistre : Entrée dans un champ, ou le bouton principal de la carte. */
  save(): void {
    this.attempted.set(true);
    this.saving = true;
    void submit(this.form).finally(() => (this.saving = false));
  }

  /** Ferme sans rien enregistrer : Échap, ou « Annuler ». Sans effet pendant un enregistrement. */
  cancel(): void {
    if (this.saving) return;
    this.cancelled.emit();
  }

  /** Entrée dans un champ enregistre ; sur un bouton, elle ne fait que le cliquer. */
  onEnter(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    this.save();
  }

  onEscape(event: Event): void {
    event.preventDefault();
    this.cancel();
  }
}
