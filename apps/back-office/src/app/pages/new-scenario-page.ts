import { Component, computed, input } from '@angular/core';
import { PageHeader } from '../shell/page-header';

@Component({
  selector: 'app-new-scenario-page',
  imports: [PageHeader],
  template: `<app-page-header title="Nouveau scénario" [trail]="trail()" />`,
})
export class NewScenarioPage {
  /** Identifiant du MJ, lu dans l'URL. */
  readonly id = input.required<string>();

  protected readonly trail = computed(() => [
    { label: 'MJ', link: '/mj' },
    { label: 'Fiche du MJ', link: `/mj/${this.id()}` },
  ]);
}
