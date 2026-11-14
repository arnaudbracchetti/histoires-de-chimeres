import { Component, computed, inject, input, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  gameMasterEndpoints,
  scenarioEndpoints,
  type ScenarioBody,
  type ScenarioDto,
} from '@chimeres/contract';
import { AccountStore, MY_SHEET_PATH } from '../account/account-store';
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
 * Nouveau scénario », ou « Ma fiche › Nouveau scénario » pour le MJ lui-même. Une fois enregistré, le scénario s'ouvre sur sa propre page.
 */
@Component({
  selector: 'app-new-scenario-page',
  imports: [Loadable, PageHeader, ScenarioForm],
  template: `
    <app-page-header title="Nouveau scénario" [trail]="trail()" />
    <app-loadable
      class="page-body"
      [resource]="gameMaster"
      failure="Impossible de charger le MJ."
      notFound="Ce MJ n'existe pas, ou plus."
    >
      @if (gameMaster.hasValue()) {
        <div class="layout">
          <app-scenario-form class="main" [save]="propose" (saved)="onProposed($event)" />
          <p class="aside image-zone">Tu pourras ajouter une image après l'enregistrement.</p>
        </div>
      }
    </app-loadable>
  `,
  styleUrl: './scenario-layout.css',
  styles: `
    @layer components {
      app-loadable {
        display: flex;
        flex-direction: column;
        gap: var(--space-l);
      }

      .image-zone {
        display: grid;
        place-items: center;
        /* La place de l'aperçu 3:2 que prendra l'image. */
        aspect-ratio: 3 / 2;
        padding: var(--space-l);
        border: 1px dashed var(--border);
        border-radius: var(--radius-card);
        color: var(--text-muted);
        text-align: center;
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

  private readonly accountStore = inject(AccountStore);
  /** « MJ › pseudo » pour un Organisateur, « Ma fiche » pour le MJ lui-même. */
  protected readonly trail = computed(() => {
    if (this.accountStore.isMine(this.id())) return [{ label: 'Ma fiche', link: MY_SHEET_PATH }];
    return [
      ...(this.accountStore.can(gameMasterEndpoints.list) ? [{ label: 'MJ', link: '/mj' }] : []),
      { label: this.loaded()?.nickname ?? 'Fiche du MJ', link: `/mj/${this.id()}` },
    ];
  });

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
