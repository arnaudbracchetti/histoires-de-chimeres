import { Component } from '@angular/core';
import { ScenarioList } from '../scenarios/scenario-list';
import { PageHeader } from '../shell/page-header';

@Component({
  selector: 'app-scenarios-page',
  imports: [PageHeader, ScenarioList],
  template: `
    <app-page-header title="Scénarios" />
    <app-scenario-list />
  `,
  styles: `
    @layer components {
      app-scenario-list {
        padding: var(--space-l) var(--space-xl);
      }
    }
  `,
})
export class ScenariosPage {}
