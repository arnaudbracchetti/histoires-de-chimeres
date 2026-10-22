import { Component } from '@angular/core';
import { PageHeader } from '../shell/page-header';

@Component({
  selector: 'app-scenario-page',
  imports: [PageHeader],
  template: `<app-page-header title="Scénario" [trail]="[{ label: 'Scénarios', link: '/scenarios' }]" />`,
})
export class ScenarioPage {}
