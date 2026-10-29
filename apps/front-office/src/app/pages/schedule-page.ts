import { Component } from '@angular/core';

/** Le programme des parties, créneau par créneau. Vide pour l'instant. */
@Component({
  selector: 'app-schedule-page',
  template: `<h1>Programme</h1>`,
  styles: `
    @layer components {
      h1 {
        font-size: var(--font-size-title);
      }
    }
  `,
})
export class SchedulePage {}
