import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { scenarioEndpoints, type ScenarioBody, type ScenarioDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { apiResource } from '../api-resource';
import type { UnsavedChanges } from '../shell/leave-unsaved';
import { ScenarioForm } from './scenario-form';
import { ScenarioImage } from './scenario-image';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { fr } from '../typography/french';
import { Confirmation } from '../ui/confirmation';
import { MoreMenu, type MoreMenuItem } from '../ui/more-menu';

const MENU: readonly MoreMenuItem[] = [
  { value: 'remove', label: 'Supprimer le scénario', danger: true },
];

/**
 * Page d'un scénario : « Scénarios › titre », son MJ, la zone de son image, et la saisie de son contenu, de
 * ses places et de sa durée (PR-14), et son image (PR-7), qui part hors de « Enregistrer ». Quitter avec des modifications non enregistrées demande
 * confirmation. La suppression passe par « ⋯ », après confirmation, puis revient à la liste.
 */
@Component({
  selector: 'app-scenario-page',
  imports: [Loadable, MoreMenu, PageHeader, RouterLink, ScenarioForm, ScenarioImage],
  template: `
    <app-page-header
      [title]="scenario()?.title ?? 'Scénario'"
      [trail]="[{ label: 'Scénarios', link: '/scenarios' }]"
    >
      @if (scenario(); as scenario) {
        <app-more-menu
          label="Autres actions sur le scénario"
          [items]="menu"
          (selected)="onMenu($event, scenario)"
        />
      }
    </app-page-header>
    <app-loadable [resource]="resource" [failure]="failure()">
      @if (scenario(); as scenario) {
        <p class="game-master">
          Proposé par
          <a [routerLink]="['/mj', scenario.gameMaster.id]">{{ scenario.gameMaster.nickname }}</a>
        </p>
        <app-scenario-image
          [scenarioId]="scenario.id"
          [title]="scenario.title"
          [imageUrl]="imageUrl()"
          (changed)="imageUrl.set($event.imageUrl)"
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

  /**
   * À part du scénario : changer l'image ne passe pas par le formulaire, dont la saisie en cours
   * repartirait de zéro avec un nouveau scénario.
   */
  protected readonly imageUrl = linkedSignal(() => this.scenario()?.imageUrl ?? null);

  protected readonly failure = computed(() => {
    const error = this.resource.error();
    return error instanceof HttpErrorResponse && error.status === 404
      ? "Ce scénario n'existe pas, ou plus."
      : 'Impossible de charger le scénario.';
  });

  private readonly form = viewChild(ScenarioForm);
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly confirmation = inject(Confirmation);
  private readonly router = inject(Router);
  protected readonly menu = MENU;
  /** Posé une fois le scénario supprimé : rien ne reste à enregistrer en quittant la page. */
  private removed = false;

  protected readonly update = (body: ScenarioBody) =>
    this.apiCall(scenarioEndpoints.update, { params: { scenarioId: this.id() }, body });

  hasUnsavedChanges(): boolean {
    return !this.removed && (this.form()?.hasUnsavedChanges() ?? false);
  }

  protected onUpdated(scenario: ScenarioDto): void {
    this.resource.set(scenario);
    this.announcer.announce(fr`Scénario « ${scenario.title} » enregistré.`);
  }

  protected onMenu(value: string, scenario: ScenarioDto): void {
    if (value === 'remove') void this.remove(scenario);
  }

  private async remove({ id, title }: ScenarioDto) {
    const removed = await this.confirmation.ask({
      question: fr`Supprimer le scénario « ${title} » ?`,
      confirmLabel: 'Supprimer le scénario',
      action: () => this.apiCall(scenarioEndpoints.remove, { params: { scenarioId: id } }),
      onStale: () => this.resource.reload(),
    });
    if (!removed) return;
    this.removed = true;
    this.announcer.announce(fr`Scénario « ${title} » supprimé.`);
    await this.router.navigate(['/scenarios']);
  }
}
