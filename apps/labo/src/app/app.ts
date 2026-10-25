import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Lab } from './lab';

@Component({
  selector: 'labo-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Créé à l'ouverture, pour observer dès la première page.
  protected readonly lab = inject(Lab);
}
