import { Component } from '@angular/core';
import { GameMasterList } from '../game-masters/game-master-list';
import { PageHeader } from '../shell/page-header';

@Component({
  selector: 'app-game-masters-page',
  imports: [GameMasterList, PageHeader],
  template: `
    <app-page-header title="MJ" />
    <app-game-master-list />
  `,
  styles: `
    @layer components {
      app-game-master-list {
        padding: var(--space-l) var(--space-xl);
      }
    }
  `,
})
export class GameMastersPage {}
