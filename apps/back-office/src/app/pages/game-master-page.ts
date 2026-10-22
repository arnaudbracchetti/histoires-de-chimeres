import { Component } from '@angular/core';
import { PageHeader } from '../shell/page-header';

@Component({
  selector: 'app-game-master-page',
  imports: [PageHeader],
  template: `<app-page-header title="Fiche du MJ" [trail]="[{ label: 'MJ', link: '/mj' }]" />`,
})
export class GameMasterPage {}
