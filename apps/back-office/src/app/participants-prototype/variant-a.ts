/**
 * PROTOTYPE, à jeter (#135). Variante A, « Tableau et fiche » : comme les MJ. Une liste en
 * tableau (une colonne par créneau), et une fiche sur sa propre page, une carte par créneau ; la
 * carte d'un créneau ouvert se retourne en saisie pour inscrire.
 */
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { MoreMenu, type MoreMenuItem } from '../ui/more-menu';
import { PrototypeGestures, PseudoField } from './prototype-gestures';
import { PrototypeStore, STATE_LABELS, slotLabel, type Pseudo, type Slot } from './prototype-data';

@Component({
  selector: 'app-variant-a-list',
  imports: [Button, PageHeader, PseudoField, RouterLink],
  template: `
    <app-page-header title="Participants" />
    <div class="body">
      <input
        #q
        type="search"
        class="filter"
        placeholder="Pseudo ou titre d’une partie"
        aria-label="Chercher un pseudo, ou une partie où il est inscrit"
        [value]="query()"
        (input)="query.set(q.value)"
      />
      <table>
        <thead>
          <tr>
            <th>Pseudo</th>
            <th class="n">Tél.</th>
            @for (slot of store.slots(); track slot.id) {
              <th [title]="labels[slot.state]">C{{ slot.rank }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.pseudo.id) {
            <tr>
              <th scope="row">
                <a [routerLink]="['/participants', row.pseudo.id]" [queryParams]="{ variant: 'A' }">{{
                  row.pseudo.nickname
                }}</a>
                @if (row.pseudo.kind === 'gm') {
                  <span class="tag">MJ</span>
                }
                @if (row.byGame) {
                  <span class="by">inscrit à {{ row.byGame }}</span>
                }
              </th>
              <td class="n">{{ row.pseudo.phones.length || '' }}</td>
              @for (cell of row.cells; track $index) {
                <td [class]="cell.tone">{{ cell.label }}</td>
              }
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="none">Aucun pseudo ne correspond.</td>
            </tr>
          }
          @if (adding()) {
            <tr class="new">
              <td colspan="7">
                <app-pseudo-field
                  label="Nouveau pseudo"
                  action="Créer"
                  [run]="create"
                  (cancelled)="adding.set(false)"
                  (open)="openSheet($event)"
                />
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!adding()) {
        <button type="button" appButton="secondary" (click)="adding.set(true)">
          Créer un pseudo
        </button>
      }
    </div>
  `,
  styles: `
    .body {
      display: flex;
      flex-direction: column;
      gap: var(--space-m);
      align-items: flex-start;
      padding: var(--space-l) var(--space-xl);
    }
    .filter {
      width: 22rem;
    }
    table {
      width: 72rem;
      table-layout: fixed;
    }
    th:first-child {
      width: 20rem;
    }
    th.n,
    td.n {
      width: 3.5rem;
      text-align: right;
    }
    tr {
      height: 48px;
    }
    td {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: var(--font-size-meta);
    }
    tbody tr:hover {
      background: var(--surface-1);
    }
    tbody th a {
      color: var(--text);
      font-weight: 600;
    }
    .tag {
      margin-left: var(--space-xs);
      padding: 0 var(--space-xs);
      border-radius: 999px;
      background: var(--surface-3);
      color: var(--text-muted);
      font-size: var(--font-size-overline);
    }
    .by {
      display: block;
      color: var(--text-muted);
      font-size: var(--font-size-overline);
      font-weight: 400;
    }
    .unplaced {
      color: var(--danger);
    }
    .leads {
      color: var(--accent);
    }
    .signed,
    .none {
      color: var(--text-muted);
    }
  `,
})
export class VariantAList {
  protected readonly store = inject(PrototypeStore);
  private readonly router = inject(Router);
  protected readonly labels = STATE_LABELS;
  protected readonly query = signal('');
  protected readonly adding = signal(false);
  protected readonly rows = computed(() =>
    this.store.search(this.query()).map(({ pseudo, byGame }) => ({
      pseudo,
      byGame,
      cells: this.store.slots().map((slot) => this.store.summary(pseudo, slot)),
    })),
  );

  protected readonly create = (value: string) => {
    const result = this.store.create(value);
    if ('message' in result) return result;
    this.openSheet(result.id);
    return undefined;
  };

  protected openSheet(id: string): void {
    void this.router.navigate(['/participants', id], { queryParams: { variant: 'A' } });
  }
}

const MENU_PARTICIPANT: MoreMenuItem[] = [
  { value: 'merge', label: 'Fusionner dans un autre pseudo…' },
  { value: 'remove', label: 'Supprimer le pseudo', danger: true },
];

@Component({
  selector: 'app-variant-a-sheet',
  imports: [Button, Icon, MoreMenu, PageHeader, PseudoField],
  template: `
    @if (pseudo(); as p) {
      <app-page-header
        [title]="p.nickname"
        [trail]="[{ label: 'Participants', link: '/participants' }]"
        [titleHidden]="renaming()"
      >
        <ng-container ngProjectAs="[appPageTitle]">
          @if (renaming()) {
            <app-pseudo-field
              [initial]="p.nickname"
              [run]="rename"
              (done)="renaming.set(false)"
              (cancelled)="renaming.set(false)"
              (open)="go($event)"
            />
          } @else {
            <button
              type="button"
              appButton="icon"
              aria-label="Renommer le pseudo"
              title="Renommer le pseudo"
              (click)="renaming.set(true)"
            >
              <app-icon name="pencil" />
            </button>
            @if (p.kind === 'gm') {
              <span class="tag">MJ</span>
            }
          }
        </ng-container>
        <ng-container ngProjectAs="[appPageSubtitle]">
          <p class="phones">
            @if (p.phones.length) {
              {{ p.phones.length }} téléphone(s) relié(s), à
              @for (phone of p.phones; track $index) {
                {{ phone.linkedAt }}{{ $last ? '' : ', ' }}
              }
              <button type="button" appButton="quiet" (click)="gestures.cutLinks(p)">
                Couper les liens
              </button>
            } @else {
              Aucun téléphone relié
            }
          </p>
        </ng-container>
        @if (p.kind === 'participant') {
          <app-more-menu
            label="Autres actions sur le pseudo"
            [items]="menu"
            (selected)="onMenu($event, p)"
          />
        }
      </app-page-header>
      <div class="slots">
        @for (slot of store.slots(); track slot.id) {
          <article class="slot" [class.editing]="editing() === slot.id">
            <header>
              <h2>{{ slotLabel(slot) }}</h2>
              <span class="time">{{ slot.start }} – {{ slot.end }}</span>
              <span class="badge" [class]="slot.state">{{ labels[slot.state] }}</span>
            </header>
            @if (store.leadsOn(p.id, slot.id); as led) {
              <p class="leads">Mène <strong>{{ led.title }}</strong>, table {{ led.table }}.</p>
            }
            @switch (slot.state) {
              @case ('open') {
                @if (editing() === slot.id) {
                  <ul class="games">
                    @for (line of store.lines(p, slot.id); track line.game.id) {
                      <li>
                        <span class="title">
                          {{ line.game.title }}
                          @if (line.double) {
                            <span class="tag">double</span>
                          }
                        </span>
                        <span class="meta">{{ line.gameMaster }} · {{ line.game.table }}</span>
                        <span class="ratio" [class.hot]="line.veryRequested">
                          @if (line.veryRequested) {
                            <app-icon name="triangle-alert" />
                          }
                          {{ line.signedUp }} / {{ line.game.maxSeats }}
                        </span>
                        @if (line.ownGame) {
                          <span class="meta">sa partie</span>
                        } @else if (line.mine) {
                          <button type="button" appButton="quiet-danger" (click)="store.signOff(p.id, line.game.id)">
                            Désinscrire
                          </button>
                        } @else {
                          <button type="button" appButton="secondary" (click)="store.signUp(p.id, line.game.id)">
                            Inscrire{{ line.backup ? ' en secours' : '' }}
                          </button>
                        }
                      </li>
                    }
                  </ul>
                  <button type="button" appButton="primary" class="end" (click)="editing.set(undefined)">
                    Terminé
                  </button>
                } @else {
                  <ul class="mine">
                    @for (line of mine(p, slot); track line.game.id) {
                      <li>
                        {{ line.game.title }}
                        <span class="meta">{{ line.signedUp }} / {{ line.game.maxSeats }}</span>
                        @if (line.backup) {
                          <span class="tag">secours</span>
                        }
                      </li>
                    } @empty {
                      <li class="meta">Aucune inscription.</li>
                    }
                  </ul>
                  @if (p.withoutGame.includes(slot.id)) {
                    <p class="warn">
                      Sans partie : il reste dans le tirage.
                      <button type="button" appButton="quiet" (click)="store.withdraw(p.id, slot.id)">
                        Retirer du tirage
                      </button>
                    </p>
                  }
                  <button type="button" appButton="secondary" (click)="editing.set(slot.id)">
                    Modifier les inscriptions
                  </button>
                }
              }
              @case ('provisional') {
                <p>{{ resultText(p, slot) }} <span class="meta">(provisoire)</span></p>
                <p class="meta">
                  Inscriptions fermées. Pour l’inscrire, rouvre les inscriptions depuis le pilotage.
                </p>
              }
              @default {
                <p>{{ resultText(p, slot) }}</p>
                @if (p.results[slot.id] === 'unplaced') {
                  <p class="meta">
                    Il reste de la place :
                    @for (r of store.remaining(slot.id); track r.table) {
                      {{ r.table }} ({{ r.remaining }}){{ $last ? '.' : ', ' }}
                    } @empty {
                      nulle part.
                    }
                  </p>
                }
                @if (slot.state === 'published' && !p.results[slot.id] && !store.leadsOn(p.id, slot.id)) {
                  <button type="button" appButton="secondary" (click)="latecomer(p, slot)">
                    Ajouter au tirage comme non placé
                  </button>
                }
                @if (refusal(); as r) {
                  <p class="refusal">{{ r }}</p>
                }
              }
            }
          </article>
        }
      </div>
    } @else {
      <app-page-header title="Pseudo introuvable" [trail]="[{ label: 'Participants', link: '/participants' }]" />
    }
  `,
  styles: `
    .tag {
      padding: 0 var(--space-xs);
      border-radius: 999px;
      background: var(--surface-3);
      color: var(--text-muted);
      font-size: var(--font-size-overline);
    }
    .phones {
      margin: var(--space-xs) 0 0;
      color: var(--text-muted);
      font-size: var(--font-size-meta);
    }
    .slots {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(26rem, 1fr));
      gap: var(--space-m);
      padding: var(--space-l) var(--space-xl);
    }
    .slot {
      display: flex;
      flex-direction: column;
      gap: var(--space-s);
      align-items: flex-start;
      padding: var(--space-m);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface-1);
      &.editing {
        grid-column: 1 / -1;
        border-color: var(--accent);
        box-shadow: var(--halo);
      }
    }
    header {
      display: flex;
      gap: var(--space-s);
      align-items: baseline;
      width: 100%;
    }
    h2 {
      font-size: var(--font-size-block);
    }
    .time,
    .meta {
      color: var(--text-muted);
      font-size: var(--font-size-meta);
    }
    .badge {
      margin-left: auto;
      padding: 0 var(--space-s);
      border-radius: 999px;
      background: var(--surface-3);
      font-size: var(--font-size-overline);
      &.open {
        color: var(--success);
      }
      &.provisional {
        color: var(--warning);
      }
    }
    p {
      margin: 0;
    }
    .leads {
      color: var(--accent);
    }
    .warn,
    .refusal {
      color: var(--danger);
    }
    .mine,
    .games {
      width: 100%;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .mine li {
      display: flex;
      gap: var(--space-s);
      padding: var(--space-xxs) 0;
    }
    .games li {
      display: grid;
      grid-template-columns: 1fr 12rem 6rem 9rem;
      gap: var(--space-m);
      align-items: center;
      height: 44px;
      border-bottom: 1px solid var(--border);
    }
    .ratio {
      display: inline-flex;
      gap: var(--space-xxs);
      align-items: center;
      font-variant-numeric: tabular-nums;
      &.hot {
        color: var(--warning);
      }
    }
    .end {
      align-self: flex-end;
    }
  `,
})
export class VariantASheet {
  readonly id = input.required<string>();
  protected readonly store = inject(PrototypeStore);
  protected readonly gestures = inject(PrototypeGestures);
  private readonly router = inject(Router);
  protected readonly labels = STATE_LABELS;
  protected readonly slotLabel = slotLabel;
  protected readonly menu = MENU_PARTICIPANT;
  protected readonly pseudo = computed(() => this.store.find(this.id()));
  protected readonly renaming = signal(false);
  protected readonly editing = signal<string | undefined>(undefined);
  protected readonly refusal = signal<string | undefined>(undefined);

  protected readonly rename = (value: string) => this.store.rename(this.id(), value);

  protected mine(p: Pseudo, slot: Slot) {
    return this.store.lines(p, slot.id).filter((l) => l.mine);
  }

  protected resultText(p: Pseudo, slot: Slot): string {
    const r = p.results[slot.id];
    if (!r) return this.store.leadsOn(p.id, slot.id) ? '' : 'Pas dans ce tirage.';
    if (r === 'unplaced') return 'Non placé.';
    const game = this.store.game(r.gameId);
    return `Table ${game.table} : ${game.title}, avec ${this.store.nickname(game.gameMasterId)}.`;
  }

  protected async latecomer(p: Pseudo, slot: Slot) {
    this.refusal.set(await this.gestures.addLatecomer(p, slot.id));
  }

  protected go(id: string): void {
    this.renaming.set(false);
    void this.router.navigate(['/participants', id], { queryParams: { variant: 'A' } });
  }

  protected async onMenu(value: string, p: Pseudo) {
    if (value === 'remove' && (await this.gestures.remove(p)))
      void this.router.navigate(['/participants'], { queryParams: { variant: 'A' } });
    if (value === 'merge') {
      const target = await this.gestures.merge(p);
      if (target) this.go(target);
    }
  }
}
