import { Component, computed, inject, input, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  gameMasterEndpoints,
  scenarioEndpoints,
  type ScenarioBody,
  type ScenarioDto,
} from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { apiResource, currentValue } from '../api-resource';
import type { UnsavedChanges } from '../shell/leave-unsaved';
import { ScenarioForm } from './scenario-form';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { fr } from '@chimeres/design';

/**
 * Proposer un scénario depuis la fiche de son MJ, qui lui reste fixé (PR-16) : « MJ › pseudo ›
 * Nouveau scénario ». Une fois enregistré, le scénario s'ouvre sur sa propre page.
 */
@Component({
  selector: 'app-new-scenario-page',
  imports: [Loadable, PageHeader, ScenarioForm],
  template: `
    <app-page-header title="Nouveau scénario" [trail]="trail()" />
    <app-loadable
      [resource]="gameMaster"
      failure="Impossible de charger le MJ."
      notFound="Ce MJ n'existe pas, ou plus."
    >
      @if (gameMaster.hasValue()) {
        <p class="image-zone">Tu pourras ajouter une image après l'enregistrement.</p>
        <app-scenario-form [save]="propose" (saved)="onProposed($event)" />
      }
    </app-loadable>
  `,
  styles: `
    @layer components {
      app-loadable {
        display: flex;
        flex-direction: column;
        gap: var(--space-l);
        padding: var(--space-l) var(--space-xl);
      }

      .image-zone {
        display: grid;
        place-items: center;
        max-width: 44rem;
        aspect-ratio: 4 / 1;
        border: 1px dashed var(--border);
        border-radius: var(--radius-card);
        color: var(--text-muted);
      }
    }
  `,
})
export class NewScenarioPage implements UnsavedChanges {
  /** Identifiant du MJ, lu dans l'URL. */
  readonly id = input.required<string>();

  protected readonly gameMaster = apiResource(gameMasterEndpoints.read, () => ({
    gameMasterId: this.id(),
  }));
  private readonly loaded = currentValue(this.gameMaster);

  protected readonly trail = computed(() => [
    { label: 'MJ', link: '/mj' },
    {
      label: this.loaded()?.nickname ?? 'Fiche du MJ',
      link: `/mj/${this.id()}`,
    },
  ]);

  private readonly form = viewChild(ScenarioForm);
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly router = inject(Router);

  protected readonly propose = (body: ScenarioBody) =>
    this.apiCall(scenarioEndpoints.propose, { params: { gameMasterId: this.id() }, body });

  hasUnsavedChanges(): boolean {
    return this.form()?.hasUnsavedChanges() ?? false;
  }

  protected async onProposed(scenario: ScenarioDto): Promise<void> {
    this.announcer.announce(fr`Scénario « ${scenario.title} » proposé.`);
    await this.router.navigate(['/scenarios', scenario.id], { replaceUrl: true });
  }
}
