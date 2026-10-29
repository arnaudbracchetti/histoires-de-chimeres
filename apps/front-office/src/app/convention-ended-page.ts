import { Component } from '@angular/core';

/** Après la fin du dernier créneau, l'application ne sert plus, avec ou sans code de présence. */
@Component({
  selector: 'app-convention-ended-page',
  template: `
    <h1>La convention est terminée</h1>
    <p>Merci de ta venue, et à la prochaine convention.</p>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }
    }
  `,
})
export class ConventionEndedPage {}
