import { Component, computed, contentChild, effect, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';

let nextId = 0;

/**
 * Champ de formulaire (docs/design/patterns.md, Champs) : libellé au-dessus, aide puis erreur
 * dessous, reliées au contrôle projeté par `aria-describedby`. Le contrôle est natif et porte
 * `[formField]`. L'erreur s'affiche une fois le champ quitté, ou après un envoi, dans la place
 * réservée sous le champ : elle ne décale rien.
 */
@Component({
  selector: 'app-field',
  template: `
    <label [for]="controlId">{{ label() }}</label>
    <ng-content />
    @if (help()) {
      <p class="help" [id]="helpId">{{ help() }}</p>
    }
    <!-- Ligne réservée, vide sans erreur. -->
    <p class="error" [id]="errorId">{{ error() }}</p>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        text-align: left;
      }

      label {
        font-weight: 600;
      }

      .help {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      /* Deux lignes réservées : un refus de l'API tient sur deux lignes à la largeur d'un téléphone. */
      .error {
        min-height: 2lh;
        color: var(--danger);
        font-size: var(--font-size-meta);
        line-height: 1.4;
      }
    }
  `,
})
export class Field {
  readonly label = input.required<string>();
  readonly help = input<string>();

  private readonly control = contentChild.required(FormField);
  private readonly id = nextId++;
  protected readonly controlId = `field-${this.id}`;
  protected readonly helpId = `field-${this.id}-help`;
  protected readonly errorId = `field-${this.id}-error`;

  protected readonly error = computed(() => {
    const state = this.control().state();
    return state.touched() ? state.errors()[0]?.message : undefined;
  });

  constructor() {
    effect(() => {
      const element = this.control().element;
      const describedBy = [this.help() && this.helpId, this.error() && this.errorId].filter(
        Boolean,
      );
      element.id = this.controlId;
      element.setAttribute('aria-invalid', String(!!this.error()));
      if (describedBy.length) element.setAttribute('aria-describedby', describedBy.join(' '));
      else element.removeAttribute('aria-describedby');
    });
  }
}
