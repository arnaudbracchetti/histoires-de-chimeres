import { Component, computed, inject, signal } from '@angular/core';
import { frontOfficeEndpoints } from '@chimeres/contract';
import { apiResource } from './api-resource';
import { ConventionEndedPage } from './convention-ended-page';
import { PresenceCodePage } from './presence-code-page';
import { PresenceCodeStore } from './presence-code-store';
import { readProblem } from './problem';

@Component({
  selector: 'app-root',
  imports: [ConventionEndedPage, PresenceCodePage],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly frontOffice = apiResource(frontOfficeEndpoints.read);
  protected readonly presenceCode = inject(PresenceCodeStore).code;

  /** L'écran du code a reçu le refus `convention-ended`. */
  protected readonly endedOnEntry = signal(false);
  protected readonly ended = computed(
    () =>
      this.endedOnEntry() ||
      (!!this.frontOffice.error() &&
        readProblem(this.frontOffice.error()).code === 'convention-ended'),
  );
}
