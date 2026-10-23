import { booleanAttribute, Component, computed, contentChild, effect, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';

let nextId = 0;

/**
 * Champ de formulaire (docs/design/patterns.md, Champs) : libellé au-dessus, aide puis erreur
 * dessous, reliées au contrôle projeté par `aria-describedby`. Le contrôle est natif et porte
 * `[formField]`, dessiné par `styles.css`. L'erreur s'affiche une fois le champ quitté, ou après un
 * envoi, dans la place réservée sous le champ (une ligne, ou `--field-error-lines`). Dans une carte compacte à un
 * seul champ (`compact`), elle s'affiche en bulle sous la carte (l'ancêtre positionné), sans
 * couvrir ses boutons. Elle ne décale jamais rien. `attempted` à faux tait une valeur manquante
 * jusqu'à la tentative d'enregistrement.
 */
@Component({
  selector: 'app-field',
  host: { '[class.compact]': 'compact()' },
  template: `
    <label [for]="controlId" [class.visually-hidden]="labelHidden()">
      {{ label() }}
      @if (optional()) {
        <span class="optional">facultatif</span>
      }
    </label>
    <ng-content />
    @if (help()) {
      <p class="help" [id]="helpId">{{ help() }}</p>
    }
    @if (!compact() || error()) {
      <!-- Ligne réservée, vide sans erreur ; en compact, bulle sous la carte. -->
      <p class="error" [id]="errorId">{{ error() }}</p>
    }
  `,
  styles: `
    @layer components {
      /* Le bas du champ réserve la ligne de son erreur. */
      :host {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        /* Une ligne par défaut ; un parent étroit en réserve plus par --field-error-lines. */
        padding-bottom: calc(var(--font-size-meta) * 1.4 * var(--field-error-lines, 1));
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

      /* Dans la place réservée, à la largeur du champ : l'erreur qui apparaît ne décale rien. */
      .error {
        position: absolute;
        top: calc(100% - var(--font-size-meta) * 1.4 * var(--field-error-lines, 1));
        right: 0;
        left: 0;
        color: var(--danger);
        font-size: var(--font-size-meta);
        line-height: 1.4;
      }

      /* Compact : ni ligne réservée ni position propre, la bulle se place sous la carte. */
      :host(.compact) {
        position: static;
        padding-bottom: 0;
      }

      :host(.compact) .error {
        top: calc(100% + var(--space-xxs));
        right: auto;
        white-space: nowrap;
        z-index: 2;
        padding: var(--space-xs) var(--space-s);
        border: 1px solid var(--danger);
        border-radius: var(--radius-control);
        background: var(--surface-2);
      }
    }
  `,
})
export class Field {
  readonly label = input.required<string>();
  readonly help = input<string>();
  readonly optional = input(false, { transform: booleanAttribute });
  /** Erreur en bulle par-dessus, sans ligne réservée : pour une carte de saisie. */
  readonly compact = input(false, { transform: booleanAttribute });
  /** Libellé masqué à l'écran, gardé comme nom accessible. */
  readonly labelHidden = input(false, { transform: booleanAttribute });
  /** Faux tant qu'aucun enregistrement n'a été tenté : une valeur manquante attend jusque-là. */
  readonly attempted = input(true);

  private readonly control = contentChild.required(FormField);
  private readonly id = nextId++;
  protected readonly controlId = `field-${this.id}`;
  protected readonly helpId = `field-${this.id}-help`;
  protected readonly errorId = `field-${this.id}-error`;

  protected readonly error = computed(() => {
    const state = this.control().state();
    if (!state.touched()) return undefined;
    return state.errors().find(({ kind }) => kind !== 'required' || this.attempted())?.message;
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
