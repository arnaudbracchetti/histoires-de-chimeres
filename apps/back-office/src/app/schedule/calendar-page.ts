import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConventionStore } from '../convention/convention-store';
import { ScheduleBoard } from './schedule-board';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';

/**
 * Le Calendrier, écran d'accueil : la frise du programme, et le bac de réserve dessous
 * (docs/design/patterns.md, Programmation). Sans créneau ou sans table, il invite à les créer.
 */
@Component({
  selector: 'app-calendar-page',
  imports: [Button, EmptyState, Loadable, PageHeader, RouterLink, ScheduleBoard],
  template: `
    <app-page-header title="Calendrier" />
    <app-loadable [resource]="store.convention" failure="Impossible de charger la convention.">
      @if (convention(); as convention) {
        @if (!convention.timeSlots.length) {
          <app-empty-state>
            <p>Aucun créneau pour l'instant&nbsp;: la frise attend la journée.</p>
            <a appButton="primary" routerLink="/creneaux-et-tables">Créer les créneaux</a>
            <a appButton="quiet" routerLink="/mj">Ou commencer par les MJ</a>
          </app-empty-state>
        } @else if (!convention.tables.length) {
          <app-empty-state>
            <p>Aucune table pour l'instant&nbsp;: la frise a une ligne par table.</p>
            <a appButton="primary" routerLink="/creneaux-et-tables">Ajouter les tables</a>
          </app-empty-state>
        } @else {
          <app-schedule-board [convention]="convention" />
        }
      }
    </app-loadable>
  `,
  styles: `
    @layer components {
      :host > app-loadable {
        display: block;
        padding: var(--space-l) var(--space-xl);
      }
    }
  `,
})
export class CalendarPage {
  protected readonly store = inject(ConventionStore);
  protected readonly convention = computed(() =>
    this.store.convention.hasValue() ? this.store.convention.value() : undefined,
  );
}
