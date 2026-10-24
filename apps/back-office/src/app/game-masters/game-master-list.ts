import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { gameMasterEndpoints, type GameMasterDto } from '@chimeres/contract';
import { apiResource } from '../api-resource';
import { ConventionStore } from '../convention/convention-store';
import { Loadable } from '../shell/loadable';
import { fr } from '../typography/french';
import { formatTimeRange, formatTimeSlotRanks } from '../typography/time';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { SortableHeader } from '../ui/sortable-header';
import { TableFilter } from '../ui/table-filter';
import { tableView } from '../ui/table-view';
import { NewGameMaster } from './new-game-master';

/**
 * Les MJ, en tableau (docs/design/patterns.md, Tableaux et MJ) : chaque pseudo mène à la fiche,
 * suivi de son nombre de scénarios ; ses disponibilités s'affichent en ronds numérotés, un par
 * créneau, de même taille : plein si le MJ peut y mener une partie, cerclé sinon.
 * Le filtre et le tri, sur le pseudo, viennent de `tableView()`. « Ajouter un MJ », sous le
 * tableau, ouvre une ligne « Nouveau MJ » en dernier ; après chaque ajout, une ligne vide s'ouvre
 * aussitôt. Quitter la page pendant une saisie l'abandonne sans rien demander.
 */
@Component({
  selector: 'app-game-master-list',
  imports: [Button, EmptyState, Loadable, NewGameMaster, RouterLink, SortableHeader, TableFilter],
  template: `
    <app-loadable [resource]="gameMasters" failure="Impossible de charger les MJ.">
      @if (gameMasters.hasValue()) {
        @if (!gameMasters.value().length && !adding()) {
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
                        <span class="pip" [class.available]="pip.available" [title]="pip.title">{{
                          pip.rank
                        }}</span>
                      }
                    </span>
                  </td>
                </tr>
              } @empty {
                @if (view.filter()) {
                  <tr>
                    <td class="none" colspan="3">
                      Aucun MJ ne correspond
                      <button type="button" appButton="quiet" (click)="clearFilter()">
                        Effacer le filtre
                      </button>
                    </td>
                  </tr>
                }
              }
              @for (key of newKeys(); track key) {
                <tr class="new">
                  <td colspan="3">
                    <app-new-game-master (added)="onAdded($event)" (cancelled)="closeNew()" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (!adding()) {
            <button type="button" appButton="secondary" class="add" (click)="openNew()">
              Ajouter un MJ
            </button>
          }
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
        width: 40rem;
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

      /* Un rond par créneau, de même taille quel que soit l'état : plein ou cerclé, son rang dedans. */
      .pip {
        display: inline-grid;
        place-items: center;
        box-sizing: border-box;
        width: 1.375rem;
        height: 1.375rem;
        border: 1px solid var(--engraving-strong);
        border-radius: 50%;
        color: var(--text-muted);
        font-size: var(--font-size-overline);
        font-variant-numeric: tabular-nums;
        line-height: 1;

        &.available {
          border-color: var(--accent);
          background: var(--accent);
          color: var(--on-accent);
          font-weight: 600;
        }
      }

      tbody tr:not(.new):hover {
        background: var(--surface-1);
      }

      /* La bulle d'erreur de la ligne « Nouveau MJ » se place sous la cellule. */
      .new td {
        position: relative;
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
  protected readonly view = tableView({
    items: () => (this.gameMasters.hasValue() ? this.gameMasters.value() : []),
    searchIn: ({ nickname }) => [nickname],
    sortKeys: { nickname: ({ nickname }: GameMasterDto) => nickname },
    initialSort: 'nickname',
  });
  /** La ligne d'ajout : une clé neuve à chaque ligne ouverte (pour la recréer vide), ou aucune. */
  protected readonly newKeys = signal<number[]>([]);
  protected readonly adding = computed(() => this.newKeys().length > 0);
  private nextKey = 0;

  private readonly store = inject(ConventionStore);
  private readonly filter = viewChild(TableFilter);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

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
      return { gameMaster, pips, summary: availabilitySummary(pips) };
    });
  });

  /** Ouvre une ligne d'ajout vide, en dernier ; le filtre s'efface pour montrer tous les MJ. */
  protected openNew(): void {
    this.view.clear();
    this.newKeys.set([this.nextKey++]);
  }

  /** Un MJ est créé : la liste est à jour, et une nouvelle ligne vide s'ouvre (saisie à la chaîne). */
  protected onAdded(gameMasters: GameMasterDto[]): void {
    this.gameMasters.set(gameMasters);
    this.openNew();
  }

  /** Ferme la ligne d'ajout ; le focus revient à « Ajouter un MJ », ou à l'invitation de l'état vide. */
  protected closeNew(): void {
    this.newKeys.set([]);
    this.focusAfterRender('.add, .empty button');
  }

  /** Toutes les lignes reviennent, et le focus retourne au filtre. */
  protected clearFilter(): void {
    this.view.clear();
    this.filter()?.focus();
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

/** « créneaux 1 et 3 », « créneau 2 », « Aucune » : le texte des pastilles, pour les lecteurs d'écran. */
function availabilitySummary(pips: { rank: number; available: boolean }[]): string {
  const ranks = pips.filter(({ available }) => available).map(({ rank }) => rank);
  return formatTimeSlotRanks(ranks) || 'Aucune';
}
