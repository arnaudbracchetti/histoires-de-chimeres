import { Component, computed, inject } from '@angular/core';
import { tableEndpoints, type TableDto } from '@chimeres/contract';
import { ConventionStore } from '../convention/convention-store';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { fr } from '../typography/french';
import { Button } from '../ui/button';
import { AddCard, Card } from '../ui/card';
import { CardEditing } from '../ui/card-editing';
import { IconTile } from '../ui/icon-tile';
import { TableEditor } from './table-editor';

/**
 * Les tables, dans l'ordre naturel que renvoie l'API, en petites cartes sur une grille
 * (docs/design/patterns.md, Tables) : le geste des créneaux, en plus compact. « Modifier »
 * retourne la carte en saisie, et les autres s'estompent le temps de la saisie. « Ajouter une
 * table » ouvre une carte de saisie en dernier ; après l'ajout, la suivante s'ouvre aussitôt.
 * Quitter la page pendant une saisie l'abandonne sans rien demander.
 */
@Component({
  selector: 'app-table-list',
  imports: [AddCard, Button, Card, IconTile, Loadable, TableEditor],
  template: `
    <app-loadable [resource]="store.convention" failure="Impossible de charger les tables.">
      <ul class="grid" aria-label="Tables de la convention">
        @for (table of tables(); track table.id) {
          <li>
            @if (cards.editing() === table.id) {
              <article appCard editing [cardId]="table.id">
                <app-table-editor
                  [table]="table"
                  (saved)="cards.close(table.id)"
                  (cancelled)="cards.close(table.id)"
                />
              </article>
            } @else {
              <article
                appCard
                tabindex="-1"
                [cardId]="table.id"
                [dimmed]="cards.isDimmed(table.id)"
                [attr.aria-labelledby]="'table-' + table.id"
              >
                <div class="heading">
                  <app-icon-tile name="dices" />
                  <h3 [id]="'table-' + table.id">{{ table.name }}</h3>
                </div>
                <div class="buttons">
                  <button
                    type="button"
                    appButton="secondary"
                    [attr.aria-label]="'Modifier la table ' + table.name"
                    (click)="cards.edit(table.id)"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    appButton="quiet-danger"
                    [attr.aria-label]="'Supprimer la table ' + table.name"
                    (click)="remove(table)"
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            }
          </li>
        }
        <li>
          @for (key of cards.newKeys(); track key) {
            <article appCard editing>
              <app-table-editor (saved)="cards.openNew()" (cancelled)="cards.closeNew()" />
            </article>
          } @empty {
            <button
              appAddCard
              aria-label="Ajouter une table"
              [dimmed]="cards.isDimmed('new')"
              (click)="cards.openNew()"
            >
              Ajouter une table
            </button>
          }
        </li>
      </ul>
    </app-loadable>
  `,
  styles: `
    @layer components {
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, 13rem);
        gap: var(--space-s);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: flex;
      }

      /* Toutes les cartes ont la même hauteur, carte en saisie comprise : rien ne bouge. */
      .card,
      .add {
        flex: 1;
        height: 84px;
      }

      .card {
        flex-direction: column;
        justify-content: space-between;
        padding: var(--space-s) var(--space-m);
      }

      .heading {
        display: flex;
        gap: var(--space-s);
        align-items: center;
        min-width: 0;
      }

      h3 {
        overflow: hidden;
        font-size: var(--font-size-block);
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .buttons {
        display: flex;
        gap: var(--space-xs);
      }
    }
  `,
})
export class TableList {
  protected readonly store = inject(ConventionStore);
  private readonly announcer = inject(Announcer);
  protected readonly cards = new CardEditing();

  protected readonly tables = computed(() => this.store.value()?.tables ?? []);

  protected async remove(table: TableDto) {
    const index = this.tables().findIndex(({ id }) => id === table.id);
    const removed = await this.cards.remove(index, {
      question: fr`Supprimer la table « ${table.name} » ?`,
      confirmLabel: 'Supprimer la table',
      action: () => this.store.write(tableEndpoints.remove, { params: { tableId: table.id } }),
      onStale: () => this.store.convention.reload(),
    });
    if (removed) this.announcer.announce(fr`Table « ${table.name} » supprimée.`);
  }
}
