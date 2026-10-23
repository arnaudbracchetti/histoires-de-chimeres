import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { scenarioEndpoints, type ScenarioBody, type ScenarioDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { apiResource } from '../api-resource';
import type { UnsavedChanges } from '../scenarios/leave-unsaved';
import { ScenarioForm } from '../scenarios/scenario-form';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { ScenarioIllustration } from '../ui/scenario-illustration';

/**
 * Page d'un scénario : « Scénarios › titre », son MJ, son bandeau, et la saisie de son contenu, de
 * ses places et de sa durée (PR-14). Quitter avec des modifications non enregistrées demande
 * confirmation.
 */
@Component({
  selector: 'app-scenario-page',
  imports: [Loadable, PageHeader, RouterLink, ScenarioForm, ScenarioIllustration],
  template: `
    <app-page-header
      [title]="scenario()?.title ?? 'Scénario'"
      [trail]="[{ label: 'Scénarios', link: '/scenarios' }]"
    />
    <app-loadable [resource]="resource" [failure]="failure()">
      @if (scenario(); as scenario) {
        <p class="game-master">
          Proposé par
          <a [routerLink]="['/mj', scenario.gameMaster.id]">{{ scenario.gameMaster.nickname }}</a>
        </p>
        <app-scenario-illustration
          format="banner"
          [title]="scenario.title"
          [imageUrl]="scenario.imageUrl"
        />
        <app-scenario-form [scenario]="scenario" [save]="update" (saved)="onUpdated($event)" />
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

      .game-master {
        color: var(--text-muted);
      }

      app-scenario-illustration {
        max-width: 44rem;
        border-radius: var(--radius-card);
      }
    }
  `,
})
export class ScenarioPage implements UnsavedChanges {
  /** Identifiant du scénario, lu dans l'URL. */
  readonly id = input.required<string>();

  protected readonly resource = apiResource(scenarioEndpoints.read, () => ({
    scenarioId: this.id(),
  }));
  protected readonly scenario = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );

  protected readonly failure = computed(() => {
    const error = this.resource.error();
    return error instanceof HttpErrorResponse && error.status === 404
      ? "Ce scénario n'existe pas, ou plus."
      : 'Impossible de charger le scénario.';
  });

  private readonly form = viewChild(ScenarioForm);
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);

  protected readonly update = (body: ScenarioBody) =>
    this.apiCall(scenarioEndpoints.update, { params: { scenarioId: this.id() }, body });

  hasUnsavedChanges(): boolean {
    return this.form()?.hasUnsavedChanges() ?? false;
  }

  protected onUpdated(scenario: ScenarioDto): void {
    this.resource.set(scenario);
    this.announcer.announce(`Scénario « ${scenario.title} » enregistré.`);
  }
}
