import { Component, computed, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gameMasterEndpoints, type GameMasterDto } from '@chimeres/contract';
import { apiResource, currentValue } from '../api-resource';
import { ConventionStore } from '../convention/convention-store';
import { Loadable } from '../shell/loadable';
import { formatTimeRange, formatTimeSlotRanks, fr } from '@chimeres/design';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Pip } from '../ui/pip';
import { SortableHeader } from '../ui/sortable-header';
import { TableFilter } from '../ui/table-filter';
import { tableView } from '../ui/table-view';
import { ParticipantCreation } from '../participants/participant-creation';

/**
 * Les MJ, en tableau (docs/design/patterns.md, Tableaux et MJ) : chaque pseudo mène à la fiche,
 * suivi de son nombre de scénarios ; ses disponibilités s'affichent en ronds numérotés, un par
 * créneau, de même taille : plein si le MJ peut y mener une partie, cerclé sinon. La dernière
 * colonne compte les parties qu'il mène, une partie double une seule fois.
 * Le filtre et le tri, sur le pseudo, viennent de `tableView()`. « Ajouter un MJ », sous le
 * tableau, ouvre l'assistant « Créer un pseudo », MJ coché d'avance.
 */
@Component({
  selector: 'app-game-master-list',
  imports: [Button, EmptyState, Loadable, Pip, RouterLink, SortableHeader, TableFilter],
  template: `
    <app-loadable [resource]="gameMasters" failure="Impossible de charger les MJ.">
      @if (gameMasters.hasValue()) {
        @if (!gameMasters.value().length) {
          <app-empty-state>
            <p>Aucun MJ pour l'instant&nbsp;: la convention attend ses conteurs.</p>
            <button type="button" appButton="primary" (click)="openNew()">
              Créer le premier MJ
            </button>
          </app-empty-state>
        } @else {
          <app-table-filter label="Filtrer les MJ" [(value)]="view.filter" />
          <table>
            <caption class="visually-hidden">
              MJ de la convention
            </caption>
            <thead>
              <tr>
                <th appSortable="nickname" [view]="view">Pseudo</th>
                <th scope="col" class="number">Scénarios</th>
                <th scope="col">Disponibilités</th>
                <th scope="col" class="number">Parties</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.gameMaster.id) {
                <tr>
                  <th scope="row">
                    <a [routerLink]="['/mj', row.gameMaster.id]">{{ row.gameMaster.nickname }}</a>
                  </th>
                  <td class="scenarios number">{{ row.gameMaster.scenarios.length }}</td>
                  <td class="availabilities">
                    <span class="visually-hidden">{{ row.summary }}</span>
                    <span class="pips" aria-hidden="true">
                      @for (pip of row.pips; track pip.rank) {
                        <app-pip
                          [class.available]="pip.available"
                          [fill]="pip.available ? 'solid' : null"
                          [title]="pip.title"
                          >{{ pip.rank }}</app-pip
                        >
                      }
                    </span>
                  </td>
                  <td class="games number">{{ row.games }}</td>
                </tr>
              } @empty {
                @if (view.filter()) {
                  <tr>
                    <td class="none" colspan="4">
                      Aucun MJ ne correspond
                      <button type="button" appButton="quiet" (click)="clearFilter()">
                        Effacer le filtre
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
          <button type="button" appButton="secondary" class="add" (click)="openNew()">
            Ajouter un MJ
          </button>
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

      /* Largeur fixe : assez pour la ligne « Nouveau MJ », son champ et ses boutons. */
      table {
        width: 46rem;
      }

      .number {
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      .pips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }

      /* Plein en orange si le MJ peut y mener une partie, cerclé sinon. */
      .available {
        --pip-color: var(--accent);
      }

      tbody tr:hover {
        background: var(--surface-1);
      }

      tbody th a {
        display: block;
        color: var(--text);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }

      .none {
        color: var(--text-muted);
      }
    }
  `,
})
export class GameMasterList {
  protected readonly gameMasters = apiResource(gameMasterEndpoints.list);
  private readonly loaded = currentValue(this.gameMasters);
  protected readonly view = tableView({
    items: () => this.loaded() ?? [],
    searchIn: ({ nickname }) => [nickname],
    sortKeys: { nickname: ({ nickname }: GameMasterDto) => nickname },
    initialSort: 'nickname',
  });

  private readonly store = inject(ConventionStore);
  private readonly filter = viewChild(TableFilter);
  private readonly creation = inject(ParticipantCreation);

  /** Les MJ affichés (filtrés et triés par `view`), chacun avec un rond par créneau. */
  protected readonly rows = computed(() => {
    const timeSlots = this.store.timeSlots();
    return this.view.rows().map((gameMaster) => {
      const pips = timeSlots.map(({ id, rank, start, end }) => {
        const available = gameMaster.availabilities.includes(id);
        const state = available ? 'disponible' : 'pas disponible';
        return {
          rank,
          available,
          title: fr`Créneau ${rank} · ${formatTimeRange(start, end)} : ${state}`,
        };
      });
      const games = new Set(gameMaster.games.map(({ gameId }) => gameId)).size;
      return { gameMaster, pips, summary: availabilitySummary(pips), games };
    });
  });

  /**
   * L'assistant « Créer un pseudo », MJ coché d'avance : seule façon de créer un MJ. La liste est
   * relue à sa fermeture.
   */
  protected async openNew(): Promise<void> {
    await this.creation.open({ gameMaster: true });
    this.gameMasters.reload();
  }

  /** Toutes les lignes reviennent, et le focus retourne au filtre. */
  protected clearFilter(): void {
    this.view.clear();
    this.filter()?.focus();
  }
}

/** « créneaux 1 et 3 », « créneau 2 », « Aucune » : le texte des pastilles, pour les lecteurs d'écran. */
function availabilitySummary(pips: { rank: number; available: boolean }[]): string {
  const ranks = pips.filter(({ available }) => available).map(({ rank }) => rank);
  return formatTimeSlotRanks(ranks) || 'Aucune';
}
