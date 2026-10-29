import { Component } from '@angular/core';

/** Tes inscriptions et tes tables, créneau par créneau. Vide pour l'instant. */
@Component({
  selector: 'app-my-games-page',
  template: `<h1>Mes parties</h1>`,
  styles: `
    @layer components {
      h1 {
        font-size: var(--font-size-title);
      }
    }
  `,
})
export class MyGamesPage {}
