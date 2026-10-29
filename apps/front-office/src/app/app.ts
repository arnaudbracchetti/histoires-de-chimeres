import { Component, computed, inject, signal } from '@angular/core';
import { frontOfficeEndpoints } from '@chimeres/contract';
import { apiResource } from './api-resource';
import { ConventionEndedPage } from './convention-ended-page';
import { NicknamePage } from './identification/nickname-page';
import { LinkedPhone } from './linked-phone';
import { PresenceCodePage } from './presence-code-page';
import { PresenceCodeStore } from './presence-code-store';
import { readProblem } from './problem';
import { AlertStack } from './shell/alert-stack';
import { Shell } from './shell/shell';

/**
 * L'entrée du front office : un téléphone relié à un pseudo entre dans la coquille ; sinon, il
 * s'identifie, derrière le code de présence, demandé s'il manque (ADR 0009).
 */
@Component({
  selector: 'app-root',
  imports: [AlertStack, ConventionEndedPage, NicknamePage, PresenceCodePage, Shell],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly frontOffice = apiResource(frontOfficeEndpoints.read);
  protected readonly presenceCode = inject(PresenceCodeStore).code;
  protected readonly linkedPhone = inject(LinkedPhone);

  /** Un écran de l'identification a reçu le refus `convention-ended`. */
  protected readonly endedOnEntry = signal(false);
  protected readonly ended = computed(
    () =>
      this.endedOnEntry() ||
      (!!this.frontOffice.error() &&
        readProblem(this.frontOffice.error()).code === 'convention-ended'),
  );
  protected readonly failed = computed(
    () => !!this.frontOffice.error() || this.linkedPhone.failed(),
  );
  protected readonly loading = computed(
    () => !this.frontOffice.hasValue() || this.linkedPhone.nickname() === undefined,
  );
}
