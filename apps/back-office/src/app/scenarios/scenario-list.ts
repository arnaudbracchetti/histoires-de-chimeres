import { Component, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { scenarioEndpoints, type ScenarioListItemDto } from '@chimeres/contract';
import { apiResource } from '../api-resource';
import { Loadable } from '../shell/loadable';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { ScenarioIllustration } from '../ui/scenario-illustration';
import { SortableHeader } from '../ui/sortable-header';
import { TableFilter } from '../ui/table-filter';
import { tableView } from '../ui/table-view';
import { formatScenarioDuration, formatSeats } from './scenario-format';

/** Les colonnes triables, chacune avec le texte qu'elle compare. */
const SORT_KEYS = {
  title: (scenario: ScenarioListItemDto) => scenario.title,
  system: (scenario: ScenarioListItemDto) => scenario.system,
  gameMaster: (scenario: ScenarioListItemDto) => scenario.gameMaster.nickname,
};

/**
 * Tous les scénarios, en tableau (docs/design/patterns.md, Tableaux) : vignette, titre vers sa
 * page, jeu, MJ vers sa fiche, places, durée et parties. Le filtre (titre, jeu et MJ) et le tri
 * (titre, jeu ou MJ) viennent de `tableView()`. Sans scénario, l'état vide renvoie vers les MJ :
 * un scénario se propose depuis la fiche de son MJ.
 */
@Component({
  selector: 'app-scenario-list',
  imports: [
    Button,
    EmptyState,
    Loadable,
    RouterLink,
    ScenarioIllustration,
    SortableHeader,
    TableFilter,
  ],
  template: `
    <app-loadable [resource]="scenarios" failure="Impossible de charger les scénarios.">
      @if (scenarios.hasValue()) {
        @if (!scenarios.value().length) {
          <app-empty-state>
            <p>Aucun scénario pour l'instant&nbsp;: chaque MJ propose les siens depuis sa fiche.</p>
            <a appButton="primary" routerLink="/mj">Choisir un MJ</a>
          </app-empty-state>
        } @else {
          <app-table-filter label="Filtrer les scénarios" [(value)]="view.filter" />
          <table>
            <caption class="visually-hidden">
              Scénarios de la convention
            </caption>
            <thead>
              <tr>
                <th scope="col" class="thumb"><span class="visually-hidden">Vignette</span></th>
                @for (column of columns; track column.key) {
                  <th [appSortable]="column.key" [view]="view">{{ column.label }}</th>
                }
                <th scope="col">Places</th>
                <th scope="col">Durée</th>
                <th scope="col" class="number">Parties</th>
              </tr>
            </thead>
            <tbody>
              @for (scenario of view.rows(); track scenario.id) {
                <tr>
                  <td class="thumb">
                    <app-scenario-illustration
                      [title]="scenario.title"
                      [imageUrl]="scenario.imageUrl"
                    />
                  </td>
                  <th scope="row">
                    <a class="title" [routerLink]="['/scenarios', scenario.id]">{{
                      scenario.title
                    }}</a>
                  </th>
                  <td>{{ scenario.system }}</td>
                  <td>
                    <a [routerLink]="['/mj', scenario.gameMaster.id]">{{
                      scenario.gameMaster.nickname
                    }}</a>
                  </td>
                  <td>{{ formatSeats(scenario.seats) }}</td>
                  <td>{{ formatScenarioDuration(scenario.duration) }}</td>
                  <td class="number">{{ scenario.games }}</td>
                </tr>
              } @empty {
                <tr>
                  <td class="none" colspan="7">
                    Aucun scénario ne correspond
                    <button type="button" appButton="quiet" (click)="clearFilter()">
                      Effacer le filtre
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      }
    </app-loadable>
  `,
  styles: `
    @layer components {
      :host {
        display: block;
      }

      app-loadable {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        align-items: flex-start;
      }

      table {
        width: 64rem;
      }

      /* Lignes de 40 px, autour de vignettes de 32 px. */
      tbody tr {
        height: 40px;
      }

      tbody tr:hover {
        background: var(--surface-1);
      }

      .thumb {
        width: 32px;
      }

      app-scenario-illustration {
        width: 32px;
      }

      tbody a {
        color: var(--text);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }

      .title {
        font-weight: 600;
      }

      .number {
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      .none {
        color: var(--text-muted);
      }
    }
  `,
})
export class ScenarioList {
  protected readonly scenarios = apiResource(scenarioEndpoints.list);
  protected readonly view = tableView({
    items: () => (this.scenarios.hasValue() ? this.scenarios.value() : []),
    searchIn: ({ title, system, gameMaster }) => [title, system, gameMaster.nickname],
    sortKeys: SORT_KEYS,
    initialSort: 'title',
  });
  protected readonly columns: readonly { key: keyof typeof SORT_KEYS; label: string }[] = [
    { key: 'title', label: 'Titre' },
    { key: 'system', label: 'Jeu' },
    { key: 'gameMaster', label: 'MJ' },
  ];
  protected readonly formatSeats = formatSeats;
  protected readonly formatScenarioDuration = formatScenarioDuration;

  private readonly filter = viewChild(TableFilter);

  /** Toutes les lignes reviennent, et le focus retourne au filtre. */
  protected clearFilter(): void {
    this.view.clear();
    this.filter()?.focus();
  }
}
