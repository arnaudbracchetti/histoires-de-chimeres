import { Component, ElementRef, input, model, viewChild } from '@angular/core';

/**
 * Filtre texte au-dessus d'un tableau (docs/design/patterns.md, Tableaux) : un champ de recherche
 * lié au `filter` de `tableView()` (`[(value)]="view.filter"`). Son libellé sert de texte indicatif
 * et de nom accessible. `focus()` y ramène après « Effacer le filtre ».
 */
@Component({
  selector: 'app-table-filter',
  template: `
    <input
      #field
      type="search"
      [placeholder]="label()"
      [attr.aria-label]="label()"
      [value]="value()"
      (input)="value.set(field.value)"
    />
  `,
  styles: `
    @layer components {
      :host {
        display: block;
      }

      input {
        width: 16rem;
      }
    }
  `,
})
export class TableFilter {
  /** « Filtrer les scénarios ». */
  readonly label = input.required<string>();
  readonly value = model.required<string>();

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  focus(): void {
    this.field().nativeElement.focus();
  }
}
