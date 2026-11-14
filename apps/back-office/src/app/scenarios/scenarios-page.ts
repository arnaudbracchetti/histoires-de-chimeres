import { Component, computed, inject } from '@angular/core';
import { AccountStore } from '../account/account-store';
import { ScenarioList } from './scenario-list';
import { PageHeader } from '../shell/page-header';

/** Tous les scénarios : « Scénarios » pour un Organisateur, « Scénarios de la convention » pour un MJ seul. */
@Component({
  selector: 'app-scenarios-page',
  imports: [PageHeader, ScenarioList],
  template: `
    <app-page-header [title]="title()" />
    <app-scenario-list class="page-body" />
  `,
})
export class ScenariosPage {
  private readonly account = inject(AccountStore).value;
  protected readonly title = computed(() =>
    this.account()?.organizer === false ? 'Scénarios de la convention' : 'Scénarios',
  );
}
