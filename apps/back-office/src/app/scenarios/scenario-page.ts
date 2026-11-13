import { Component, computed, inject, input, linkedSignal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  scenarioEndpoints,
  type ScenarioBody,
  type ScenarioDto,
  type Endpoint,
  type GameMasterScenarioParams,
} from '@chimeres/contract';
import { AccountStore } from '../account/account-store';
import { injectApiCall } from '../api-call';
import { apiResource, currentValue } from '../api-resource';
import type { UnsavedChanges } from '../shell/leave-unsaved';
import { ScenarioForm } from './scenario-form';
import { ScenarioImage } from './scenario-image';
import { ScenarioReading } from './scenario-reading';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { fr } from '@chimeres/design';
import { Confirmation } from '../ui/confirmation';
import { MoreMenu, type MoreMenuItem } from '../ui/more-menu';

const MENU: readonly MoreMenuItem[] = [
  { value: 'remove', label: 'Supprimer le scénario', danger: true },
];

/**
 * Page d'un scénario : « Scénarios › titre », son MJ, la zone de son image, et la saisie de son contenu, de
 * ses places et de sa durée (PR-14), et son image (PR-7), qui part hors de « Enregistrer ». Quitter avec des modifications non enregistrées demande
 * confirmation. La suppression passe par « ⋯ », après confirmation, puis revient à la liste. Pour
 * un compte qui ne peut pas l'écrire (le scénario d'un autre MJ), la page se lit seulement, et son
 * MJ ne mène à sa fiche que si le compte peut la lire (ADR 0017).
 */
@Component({
  selector: 'app-scenario-page',
  imports: [
    Loadable,
    MoreMenu,
    PageHeader,
    RouterLink,
    ScenarioForm,
    ScenarioImage,
    ScenarioReading,
  ],
  template: `
    <app-page-header
      [title]="scenario()?.title ?? 'Scénario'"
      [trail]="[{ label: 'Scénarios', link: '/scenarios' }]"
    >
      @if (canRemove()) {
        <app-more-menu
          label="Autres actions sur le scénario"
          [items]="menu"
          (selected)="onMenu($event, scenario()!)"
        />
      }
    </app-page-header>
    <app-loadable
      [resource]="resource"
      failure="Impossible de charger le scénario."
      notFound="Ce scénario n'existe pas, ou plus."
    >
      @if (scenario(); as scenario) {
        <p class="game-master">
          Proposé par
          @if (gameMasterLink(); as link) {
            <a [routerLink]="link">{{ scenario.gameMaster.nickname }}</a>
          } @else {
            {{ scenario.gameMaster.nickname }}
          }
        </p>
        @if (canUpdate()) {
          <app-scenario-image
            [gameMasterId]="scenario.gameMaster.id"
            [scenarioId]="scenario.id"
            [title]="scenario.title"
            [imageUrl]="imageUrl()"
            (changed)="imageUrl.set($event.imageUrl)"
          />
          <app-scenario-form [scenario]="scenario" [save]="update" (saved)="onUpdated($event)" />
        } @else {
          <app-scenario-reading [scenario]="scenario" />
        }
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
  protected readonly scenario = currentValue(this.resource);

  private readonly accountStore = inject(AccountStore);
  protected readonly canUpdate = computed(() => this.canWrite(scenarioEndpoints.update));
  protected readonly canRemove = computed(() => this.canWrite(scenarioEndpoints.remove));
  protected readonly gameMasterLink = computed(() => {
    const scenario = this.scenario();
    return scenario && this.accountStore.gameMasterLink(scenario.gameMaster.id);
  });

  /**
   * À part du scénario : changer l'image ne passe pas par le formulaire, dont la saisie en cours
   * repartirait de zéro avec un nouveau scénario.
   */
  protected readonly imageUrl = linkedSignal(() => this.scenario()?.imageUrl ?? null);

  private readonly form = viewChild(ScenarioForm);
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly confirmation = inject(Confirmation);
  private readonly router = inject(Router);
  protected readonly menu = MENU;
  /** Posé une fois le scénario supprimé : rien ne reste à enregistrer en quittant la page. */
  private removed = false;

  /** Appelé par le formulaire, qui n'existe qu'une fois le scénario chargé. */
  protected readonly update = (body: ScenarioBody) => {
    const { id, gameMaster } = this.scenario()!;
    return this.apiCall(scenarioEndpoints.update, {
      params: { gameMasterId: gameMaster.id, scenarioId: id },
      body,
    });
  };

  /** Le compte connecté peut-il appeler cet endpoint d'écriture du scénario, sous son MJ ? */
  private canWrite(endpoint: Endpoint<unknown, GameMasterScenarioParams, unknown, unknown>) {
    const scenario = this.scenario();
    return (
      scenario !== undefined &&
      this.accountStore.can(endpoint, {
        gameMasterId: scenario.gameMaster.id,
        scenarioId: scenario.id,
      })
    );
  }

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

  private async remove({ id, gameMaster, title }: ScenarioDto) {
    const removed = await this.confirmation.ask({
      question: fr`Supprimer le scénario « ${title} » ?`,
      confirmLabel: 'Supprimer le scénario',
      action: () =>
        this.apiCall(scenarioEndpoints.remove, {
          params: { gameMasterId: gameMaster.id, scenarioId: id },
        }),
      onStale: () => this.resource.reload(),
    });
    if (!removed) return;
    this.removed = true;
    this.announcer.announce(fr`Scénario « ${title} » supprimé.`);
    await this.router.navigate(['/scenarios']);
  }
}
