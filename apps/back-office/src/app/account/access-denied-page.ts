import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { AccountStore, MY_SHEET_PATH } from './account-store';

/** Une page réservée aux Organisateurs, ouverte par un MJ seul : le refus, et le retour à sa fiche. */
@Component({
  selector: 'app-access-denied-page',
  imports: [Button, PageHeader, RouterLink],
  template: `
    <app-page-header title="Accès refusé" />
    <div class="body page-body">
      <p>Ton compte ne donne pas accès à cette page&nbsp;: elle est réservée aux Organisateurs.</p>
      @if (account()?.gameMasterId) {
        <a appButton="secondary" [routerLink]="mySheet">Revenir à ma fiche</a>
      }
    </div>
  `,
  styles: `
    @layer components {
      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        align-items: flex-start;
      }
    }
  `,
})
export class AccessDeniedPage {
  protected readonly account = inject(AccountStore).value;
  protected readonly mySheet = MY_SHEET_PATH;
}
