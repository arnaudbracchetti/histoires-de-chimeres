import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { tableEndpoints, type TableDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { ConventionStore } from '../convention/convention-store';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { Button } from '../ui/button';
import { Confirmation } from '../ui/confirmation';
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
  imports: [Button, IconTile, Loadable, TableEditor],
  template: `
    <app-loadable [resource]="store.convention" failure="Impossible de charger les tables.">
      <ul class="grid" [class.busy]="editing()" aria-label="Tables de la convention">
        @for (table of tables(); track table.id) {
          <li>
            @if (editing() === table.id) {
              <article
                appTableEditor
                class="card"
                [table]="table"
                (saved)="closeEditor(table.id)"
                (cancelled)="closeEditor(table.id)"
              ></article>
            } @else {
              <article
                class="card"
                tabindex="-1"
                [attr.data-table]="table.id"
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
                    (click)="edit(table)"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    appButton="quiet"
                    class="destructive"
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
          @for (key of newKeys(); track key) {
            <article
              appTableEditor
              class="card"
              (saved)="openNew()"
              (cancelled)="closeNew()"
            ></article>
          } @empty {
            <button type="button" class="add" aria-label="Ajouter une table" (click)="openNew()">
              <span aria-hidden="true">+</span> Ajouter une table
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
      .card {
        position: relative;
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: space-between;
        min-width: 0;
        height: 84px;
        padding: var(--space-s) var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-1);
        transition: opacity 150ms;

        &.editing {
          border-color: var(--accent);
          box-shadow: var(--halo);
        }
      }

      /* Pendant une saisie, les autres cartes s'estompent : on voit où l'on en est. */
      .busy .card:not(.editing),
      .busy .add {
        opacity: 0.45;
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

      .destructive {
        color: var(--danger);
      }

      .add {
        flex: 1;
        height: 84px;
        border: 1px dashed var(--border);
        border-radius: var(--radius-card);
        background: none;
        color: var(--text-muted);
        cursor: pointer;

        &:hover {
          border-color: var(--accent);
          color: var(--text);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .card {
          transition: none;
        }
      }
    }
  `,
})
export class TableList {
  protected readonly store = inject(ConventionStore);
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly confirmation = inject(Confirmation);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** La carte en saisie : l'identifiant d'une table, `new` pour un ajout, ou rien. */
  protected readonly editing = computed(() => (this.newKeys().length ? 'new' : this.editedId()));
  private readonly editedId = signal<string | undefined>(undefined);
  /** La carte d'ajout : une clé neuve à chaque carte ouverte, ou aucune. */
  protected readonly newKeys = signal<number[]>([]);
  private nextKey = 0;

  protected readonly tables = computed(() =>
    this.store.convention.hasValue() ? this.store.convention.value().tables : [],
  );

  protected openNew() {
    this.editedId.set(undefined);
    this.newKeys.set([this.nextKey++]);
  }

  protected closeNew() {
    this.newKeys.set([]);
    this.focusAfterRender(() => this.host.querySelector('.add'));
  }

  protected edit(table: TableDto) {
    this.newKeys.set([]);
    this.editedId.set(table.id);
  }

  protected closeEditor(tableId: string) {
    this.editedId.set(undefined);
    this.focusAfterRender(() => this.host.querySelector(`article[data-table="${tableId}"]`));
  }

  protected async remove(table: TableDto) {
    const index = this.tables().findIndex(({ id }) => id === table.id);
    const removed = await this.confirmation.ask({
      question: `Supprimer la table « ${table.name} » ?`,
      confirmLabel: 'Supprimer la table',
      action: async () => {
        const convention = await this.apiCall(tableEndpoints.remove, {
          params: { tableId: table.id },
        });
        this.store.convention.set(convention);
      },
    });
    if (!removed) return;
    this.announcer.announce(`Table « ${table.name} » supprimée.`);
    // Le focus va à la carte suivante, à défaut à la précédente, à défaut à « Ajouter une table ».
    this.focusAfterRender(() => {
      const cards = this.host.querySelectorAll<HTMLElement>('article.card');
      return cards[index] ?? cards[index - 1] ?? this.host.querySelector('.add');
    });
  }

  private focusAfterRender(target: () => Element | null) {
    afterNextRender(() => (target() as HTMLElement | null)?.focus(), {
      injector: this.injector,
    });
  }
}
