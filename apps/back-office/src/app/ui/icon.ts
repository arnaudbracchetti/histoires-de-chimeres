import { Component, input } from '@angular/core';

/** Une icône Lucide du sprite de `@chimeres/design`, décorative : le nom accessible est porté par son parent. */
@Component({
  selector: 'app-icon',
  template: `<svg aria-hidden="true" focusable="false"><use [attr.href]="'icons.svg#' + name()" /></svg>`,
  styles: `
    @layer components {
      :host {
        display: inline-grid;
        flex: none;
      }

      svg {
        width: 1rem;
        height: 1rem;
      }
    }
  `,
})
export class Icon {
  readonly name = input.required<string>();
}
