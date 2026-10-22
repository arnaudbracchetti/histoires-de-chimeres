import { booleanAttribute, Component, computed, contentChild, effect, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';

let nextId = 0;

/**
 * Champ de formulaire (docs/design/patterns.md, Champs) : libellé au-dessus, aide puis erreur
 * dessous, reliées au contrôle projeté par `aria-describedby`. Le contrôle est natif et porte
 * `[formField]`, dessiné par `styles.css`. L'erreur s'affiche une fois le champ quitté, ou après un envoi.
 */
@Component({
  selector: 'app-field',
  template: `
    <label [for]="controlId">
      {{ label() }}
      @if (optional()) {
        <span class="optional">facultatif</span>
      }
    </label>
    <ng-content />
    @if (help()) {
      <p class="help" [id]="helpId">{{ help() }}</p>
    }
    @if (error(); as message) {
      <p class="error" [id]="errorId">{{ message }}</p>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
      }

      label {
        font-weight: 600;
      }

      .optional {
        margin-left: var(--space-xs);
        color: var(--text-muted);
        font-weight: normal;
        font-size: var(--font-size-meta);
      }

      .help {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .error {
        color: var(--danger);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class Field {
  readonly label = input.required<string>();
  readonly help = input<string>();
  readonly optional = input(false, { transform: booleanAttribute });

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
