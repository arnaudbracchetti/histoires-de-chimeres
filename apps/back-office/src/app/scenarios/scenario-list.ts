import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { scenarioEndpoints, type ScenarioListItemDto } from '@chimeres/contract';
import { apiResource } from '../api-resource';
import { searchKey } from '../game-masters/nickname';
import { Loadable } from '../shell/loadable';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { ScenarioIllustration } from '../ui/scenario-illustration';
import { formatDuration, formatSeats } from './scenario-format';

/** Les colonnes triables, chacune avec le texte qu'elle compare. */
const SORT_KEYS = {
  title: (scenario: ScenarioListItemDto) => scenario.title,
  system: (scenario: ScenarioListItemDto) => scenario.system,
  gameMaster: (scenario: ScenarioListItemDto) => scenario.gameMaster.nickname,
} as const;

type SortColumn = keyof typeof SORT_KEYS;

/** L'ordre naturel, comme celui du domaine : « Scénario 2 » avant « Scénario 10 », sans casse ni accent. */
const NATURAL = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

/**
 * Tous les scénarios, en tableau (docs/design/patterns.md, Tableaux) : vignette, titre vers sa
 * page, jeu, MJ vers sa fiche, places, durée et parties. Tri et filtre sont des signaux, sur la
 * liste que l'API renvoie dans l'ordre naturel des titres. Sans scénario, l'état vide renvoie vers
 * les MJ : un scénario se propose depuis la fiche de son MJ.
 */
@Component({
  selector: 'app-scenario-list',
  imports: [Button, Icon, Loadable, RouterLink, ScenarioIllustration],
  template: `
    <app-loadable [resource]="scenarios" failure="Impossible de charger les scénarios.">
      @if (scenarios.hasValue()) {
        @if (!scenarios.value().length) {
          <div class="empty">
            <svg class="engraving" aria-hidden="true" focusable="false">
              <use href="illustration.svg#engraving" />
            </svg>
            <p>Aucun scénario pour l'instant : chaque MJ propose les siens depuis sa fiche.</p>
            <a appButton="primary" routerLink="/mj">Choisir un MJ</a>
          </div>
        } @else {
          <input
            type="search"
            class="filter"
            placeholder="Filtrer les scénarios"
            aria-label="Filtrer les scénarios"
            [value]="filter()"
            (input)="filter.set($any($event.target).value)"
          />
          <table>
            <caption class="visually-hidden">
              Scénarios de la convention
            </caption>
            <thead>
              <tr>
                <th scope="col" class="thumb"><span class="visually-hidden">Vignette</span></th>
                @for (column of columns; track column.key) {
                  <th scope="col" [attr.aria-sort]="ariaSort(column.key)">
                    <button type="button" class="sort" (click)="sortBy(column.key)">
                      {{ column.label }}
                      @if (sort().column === column.key) {
                        <app-icon [name]="sort().descending ? 'arrow-down' : 'arrow-up'" />
                      }
                    </button>
                  </th>
                }
                <th scope="col">Places</th>
                <th scope="col">Durée</th>
                <th scope="col" class="number">Parties</th>
              </tr>
            </thead>
            <tbody>
              @for (scenario of rows(); track scenario.id) {
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
                  <td>{{ formatDuration(scenario.duration) }}</td>
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

      .filter {
        width: 16rem;
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

      .sort {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }

      .none {
        color: var(--text-muted);
      }

      .empty {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        align-items: center;
        width: 32rem;
        padding: var(--space-xxl);
        color: var(--text-muted);
        text-align: center;
      }

      .engraving {
        width: 160px;
        height: 160px;
        color: var(--engraving);
      }
    }
  `,
})
export class ScenarioList {
  protected readonly scenarios = apiResource(scenarioEndpoints.list);
  protected readonly filter = signal('');
  protected readonly sort = signal<{ column: SortColumn; descending: boolean }>({
    column: 'title',
    descending: false,
  });
  protected readonly columns: readonly { key: SortColumn; label: string }[] = [
    { key: 'title', label: 'Titre' },
    { key: 'system', label: 'Jeu' },
    { key: 'gameMaster', label: 'MJ' },
  ];
  protected readonly formatSeats = formatSeats;
  protected readonly formatDuration = formatDuration;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  /** Les scénarios affichés : filtrés sur le titre, le jeu et le MJ, sans casse ni accent, puis triés. */
  protected readonly rows = computed(() => {
    const all = this.scenarios.hasValue() ? this.scenarios.value() : [];
    const key = searchKey(this.filter());
    const shown = all.filter(({ title, system, gameMaster }) =>
      [title, system, gameMaster.nickname].some((text) => searchKey(text).includes(key)),
    );
    const { column, descending } = this.sort();
    const keyOf = SORT_KEYS[column];
    const sorted = shown.sort((a, b) => NATURAL.compare(keyOf(a), keyOf(b)));
    return descending ? sorted.reverse() : sorted;
  });

  protected ariaSort(column: SortColumn): 'ascending' | 'descending' | null {
    const sort = this.sort();
    if (sort.column !== column) return null;
    return sort.descending ? 'descending' : 'ascending';
  }

  /** Une nouvelle colonne trie dans l'ordre naturel ; la même, une seconde fois, à l'envers. */
  protected sortBy(column: SortColumn): void {
    const sort = this.sort();
    this.sort.set({ column, descending: sort.column === column && !sort.descending });
  }

  protected clearFilter(): void {
    this.filter.set('');
    afterNextRender(() => this.host.querySelector<HTMLElement>('.filter')?.focus(), {
      injector: this.injector,
    });
  }
}
