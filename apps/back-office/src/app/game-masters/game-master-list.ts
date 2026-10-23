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
import { gameMasterEndpoints, type GameMasterDto } from '@chimeres/contract';
import { apiResource } from '../api-resource';
import { Loadable } from '../shell/loadable';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { NewGameMaster } from './new-game-master';
import { searchKey } from './nickname';

/**
 * Les MJ, en tableau (docs/design/patterns.md, Tableaux et MJ) : chaque pseudo mène à la fiche.
 * Tri et filtre sont des signaux, sur la liste que l'API renvoie dans l'ordre naturel. « Ajouter
 * un MJ », sous le tableau, ouvre une ligne « Nouveau MJ » en dernier ; après chaque ajout, une
 * ligne vide s'ouvre aussitôt. Quitter la page pendant une saisie l'abandonne sans rien demander.
 */
@Component({
  selector: 'app-game-master-list',
  imports: [Button, Icon, Loadable, NewGameMaster, RouterLink],
  template: `
    <app-loadable [resource]="gameMasters" failure="Impossible de charger les MJ.">
      @if (gameMasters.hasValue()) {
        @if (!gameMasters.value().length && !adding()) {
          <div class="empty">
            <svg class="engraving" aria-hidden="true" focusable="false">
              <use href="illustration.svg#engraving" />
            </svg>
            <p>Aucun MJ pour l'instant : la convention attend ses conteurs.</p>
            <button type="button" appButton="primary" (click)="openNew()">
              Créer le premier MJ
            </button>
          </div>
        } @else {
          <input
            type="search"
            class="filter"
            placeholder="Filtrer les MJ"
            aria-label="Filtrer les MJ"
            [value]="filter()"
            (input)="filter.set($any($event.target).value)"
          />
          <table>
            <caption class="visually-hidden">
              MJ de la convention
            </caption>
            <thead>
              <tr>
                <th scope="col" [attr.aria-sort]="descending() ? 'descending' : 'ascending'">
                  <button type="button" class="sort" (click)="descending.set(!descending())">
                    Pseudo
                    <app-icon [name]="descending() ? 'arrow-down' : 'arrow-up'" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (gameMaster of rows(); track gameMaster.id) {
                <tr>
                  <th scope="row">
                    <a [routerLink]="['/mj', gameMaster.id]">{{ gameMaster.nickname }}</a>
                  </th>
                </tr>
              } @empty {
                @if (filter()) {
                  <tr>
                    <td class="none">
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
                  <td>
                    <app-new-game-master
                      (added)="onAdded($event)"
                      (cancelled)="closeNew()"
                    />
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

      .filter {
        width: 16rem;
      }

      /* Largeur fixe : assez pour la ligne « Nouveau MJ », son champ et ses boutons. */
      table {
        width: 32rem;
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
export class GameMasterList {
  protected readonly gameMasters = apiResource(gameMasterEndpoints.list);
  protected readonly filter = signal('');
  protected readonly descending = signal(false);
  /** La ligne d'ajout : une clé neuve à chaque ligne ouverte (pour la recréer vide), ou aucune. */
  protected readonly newKeys = signal<number[]>([]);
  protected readonly adding = computed(() => this.newKeys().length > 0);
  private nextKey = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  /** Les MJ affichés : filtrés sans casse ni accent, dans l'ordre naturel ou son inverse. */
  protected readonly rows = computed(() => {
    const all = this.gameMasters.hasValue() ? this.gameMasters.value() : [];
    const key = searchKey(this.filter());
    const shown = all.filter(({ nickname }) => searchKey(nickname).includes(key));
    return this.descending() ? shown.reverse() : shown;
  });

  /** Ouvre une ligne d'ajout vide, en dernier ; le filtre s'efface pour montrer tous les MJ. */
  protected openNew(): void {
    this.filter.set('');
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

  protected clearFilter(): void {
    this.filter.set('');
    this.focusAfterRender('.filter');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
