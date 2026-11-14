import { Component } from '@angular/core';
import { GameMasterList } from './game-master-list';
import { PageHeader } from '../shell/page-header';

@Component({
  selector: 'app-game-masters-page',
  imports: [GameMasterList, PageHeader],
  template: `
    <app-page-header title="MJ" />
    <app-game-master-list class="page-body" />
  `,
})
export class GameMastersPage {}
