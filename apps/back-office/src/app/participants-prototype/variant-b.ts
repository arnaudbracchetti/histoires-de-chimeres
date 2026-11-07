/**
 * PROTOTYPE, à jeter (#135). Variante B, « Côte à côte » : la recherche à gauche, la fiche à
 * droite, sur le même écran. Rien ne change de page : on enchaîne les personnes. La recherche sert
 * aussi à créer (« Créer « xyz » » quand rien ne correspond). Les inscriptions sont une grille :
 * une ligne par créneau, une pastille par partie, qu'on allume ou éteint d'un clic.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { PrototypeGestures, PseudoField } from './prototype-gestures';
import { PrototypeStore, STATE_LABELS, type Pseudo, type Slot } from './prototype-data';

@Component({
  selector: 'app-variant-b',
  imports: [Button, Icon, PageHeader, PseudoField],
  template: `
    <app-page-header title="Participants" />
    <div class="split">
      <aside>
        <input
          #q
          type="search"
          placeholder="Pseudo ou titre d’une partie"
          aria-label="Chercher un pseudo, ou une partie où il est inscrit"
          [value]="query()"
          (input)="query.set(q.value)"
          (keydown.enter)="enter()"
        />
        <ul role="listbox" aria-label="Pseudos">
          @for (r of results(); track r.pseudo.id) {
            <li
              role="option"
              [attr.aria-selected]="r.pseudo.id === selectedId()"
              (click)="select(r.pseudo.id)"
            >
              <span class="name">{{ r.pseudo.nickname }}</span>
              @if (r.pseudo.kind === 'gm') {
                <span class="tag">MJ</span>
              }
              <span class="sub">
                @if (r.byGame) {
                  inscrit à {{ r.byGame }}
                } @else {
                  {{ r.pseudo.signUps.length }} inscr. · {{ r.pseudo.phones.length }} tél.
                }
              </span>
            </li>
          }
          @if (query().trim() && !exact()) {
            <li class="create" (click)="create()">
              <app-icon name="plus" /> Créer « {{ query().trim() }} »
            </li>
          }
        </ul>
        @if (createRefusal(); as r) {
          <p class="refusal">{{ r }}</p>
        }
      </aside>

      <section class="sheet">
        @if (selected(); as p) {
          <div class="head">
            @if (renaming()) {
              <app-pseudo-field
                [initial]="p.nickname"
                [run]="rename"
                (done)="renaming.set(false)"
                (cancelled)="renaming.set(false)"
                (open)="select($event)"
              />
            } @else {
              <h2>{{ p.nickname }}</h2>
              @if (p.kind === 'gm') {
                <span class="tag">MJ</span>
              }
            }
            <div class="actions">
              <button type="button" appButton="secondary" (click)="renaming.set(true)">Renommer</button>
              <button type="button" appButton="secondary" [disabled]="!p.phones.length" (click)="gestures.cutLinks(p)">
                Couper les liens
              </button>
              @if (p.kind === 'participant') {
                <button type="button" appButton="secondary" (click)="merge(p)">Fusionner…</button>
                <button type="button" appButton="quiet-danger" (click)="remove(p)">Supprimer</button>
              }
            </div>
          </div>
          <p class="phones">
            <app-icon name="user-round" />
            @if (p.phones.length) {
              Relié à {{ p.phones.length }} téléphone(s), à
              @for (phone of p.phones; track $index) {
                {{ phone.linkedAt }}{{ $last ? '' : ', ' }}
              }
            } @else {
              Aucun téléphone relié : il lit ses résultats ici, à l’accueil.
            }
          </p>

          <table class="grid">
            <tbody>
              @for (slot of store.slots(); track slot.id) {
                <tr [class]="slot.state">
                  <th scope="row">
                    <strong>C{{ slot.rank }}</strong> {{ slot.start }}
                    <span class="state">{{ labels[slot.state] }}</span>
                  </th>
                  <td class="result">{{ resultText(p, slot) }}</td>
                  <td class="chips">
                    @for (line of store.lines(p, slot.id); track line.game.id) {
                      <button
                        type="button"
                        class="chip"
                        [class.on]="line.mine"
                        [class.placed]="placedIn(p, slot, line.game.id)"
                        [class.own]="line.ownGame"
                        [attr.aria-pressed]="line.mine"
                        [disabled]="slot.state !== 'open' || line.ownGame"
                        [title]="line.gameMaster + ' · table ' + line.game.table + (line.veryRequested ? ' · très demandée' : '')"
                        (click)="toggle(p, line.game.id, line.mine)"
                      >
                        @if (line.mine) {
                          <app-icon name="check" />
                        }
                        {{ line.game.title }}
                        @if (line.double) {
                          <span class="dbl">×2</span>
                        }
                        <span class="ratio" [class.hot]="line.veryRequested">
                          @if (slot.state === 'open' || slot.state === 'provisional') {
                            {{ line.signedUp }}/{{ line.game.maxSeats }}
                          } @else {
                            reste {{ line.remaining }}
                          }
                        </span>
                        @if (line.backup && !line.ownGame && slot.state === 'open') {
                          <span class="dbl">secours</span>
                        }
                      </button>
                    }
                    @if (slot.state === 'open' && p.withoutGame.includes(slot.id)) {
                      <button type="button" appButton="quiet" (click)="store.withdraw(p.id, slot.id)">
                        Sans partie · retirer du tirage
                      </button>
                    }
                    @if (slot.state === 'published' && !p.results[slot.id] && !store.leadsOn(p.id, slot.id)) {
                      <button type="button" appButton="secondary" (click)="latecomer(p, slot)">
                        + Retardataire
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (refusal(); as r) {
            <p class="refusal">{{ r }}</p>
          }
          <p class="hint">
            Un clic sur une partie d’un créneau ouvert inscrit ou désinscrit, sans confirmation. Les
            chiffres : inscrits / places max ; après la publication, les places restantes.
          </p>
        } @else {
          <p class="empty">Cherche un pseudo, ou une partie où il est inscrit.</p>
        }
      </section>
    </div>
  `,
  styles: `
    .split {
      display: grid;
      grid-template-columns: 20rem 1fr;
      height: calc(100vh - 6rem);
    }
    aside {
      display: flex;
      flex-direction: column;
      gap: var(--space-s);
      padding: var(--space-m);
      overflow: hidden;
      border-right: 1px solid var(--border);
      input {
        width: 100%;
      }
    }
    ul {
      flex: 1;
      margin: 0;
      padding: 0;
      overflow: auto;
      list-style: none;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      gap: 0 var(--space-xs);
      align-items: baseline;
      padding: var(--space-xs) var(--space-s);
      border-radius: var(--radius-control);
      cursor: pointer;
      &:hover {
        background: var(--surface-2);
      }
      &[aria-selected='true'] {
        background: var(--surface-3);
        box-shadow: inset 3px 0 var(--accent);
      }
    }
    .name {
      font-weight: 600;
    }
    .sub {
      flex-basis: 100%;
      color: var(--text-muted);
      font-size: var(--font-size-overline);
    }
    .create {
      gap: var(--space-xs);
      align-items: center;
      color: var(--accent);
    }
    .tag {
      padding: 0 var(--space-xs);
      border-radius: 999px;
      background: var(--surface-3);
      color: var(--text-muted);
      font-size: var(--font-size-overline);
    }
    .sheet {
      display: flex;
      flex-direction: column;
      gap: var(--space-m);
      padding: var(--space-l) var(--space-xl);
      overflow: auto;
    }
    .head {
      display: flex;
      gap: var(--space-s);
      align-items: center;
      h2 {
        font-family: var(--font-display);
        font-size: var(--font-size-title);
      }
    }
    .actions {
      display: flex;
      gap: var(--space-xs);
      margin-left: auto;
    }
    .phones {
      display: flex;
      gap: var(--space-xs);
      align-items: center;
      margin: 0;
      color: var(--text-muted);
    }
    .grid {
      width: 100%;
      border-collapse: collapse;
      tr {
        border-bottom: 1px solid var(--border);
      }
      tr.ended {
        opacity: 0.6;
      }
      th,
      td {
        padding: var(--space-s);
        vertical-align: top;
        text-align: left;
      }
      th {
        width: 9rem;
        font-weight: 400;
      }
    }
    .state {
      display: block;
      color: var(--text-muted);
      font-size: var(--font-size-overline);
    }
    .result {
      width: 16rem;
      font-weight: 600;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
    }
    .chip {
      display: inline-flex;
      gap: var(--space-xs);
      align-items: center;
      padding: var(--space-xxs) var(--space-s);
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface-1);
      color: var(--text);
      cursor: pointer;
      &.on {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 18%, var(--surface-1));
      }
      &.placed {
        outline: 2px solid var(--success);
      }
      &.own {
        border-style: dashed;
      }
      &:disabled {
        cursor: default;
      }
    }
    .ratio {
      color: var(--text-muted);
      font-size: var(--font-size-overline);
      font-variant-numeric: tabular-nums;
      &.hot {
        color: var(--warning);
      }
    }
    .dbl {
      color: var(--text-muted);
      font-size: var(--font-size-overline);
    }
    .refusal {
      color: var(--danger);
    }
    .hint,
    .empty {
      color: var(--text-muted);
      font-size: var(--font-size-meta);
    }
  `,
})
export class VariantB {
  protected readonly store = inject(PrototypeStore);
  protected readonly gestures = inject(PrototypeGestures);
  protected readonly labels = STATE_LABELS;
  protected readonly query = signal('');
  protected readonly selectedId = signal<string | undefined>('p-elodie');
  protected readonly renaming = signal(false);
  protected readonly refusal = signal<string | undefined>(undefined);
  protected readonly createRefusal = signal<string | undefined>(undefined);
  protected readonly results = computed(() => this.store.search(this.query()));
  protected readonly selected = computed(() => this.store.find(this.selectedId()));
  protected readonly exact = computed(() => this.store.taken(this.query()));

  protected readonly rename = (value: string) => this.store.rename(this.selectedId()!, value);

  protected select(id: string): void {
    this.selectedId.set(id);
    this.renaming.set(false);
    this.refusal.set(undefined);
  }

  protected enter(): void {
    const first = this.results()[0];
    if (this.exact()) this.select(this.exact()!.id);
    else if (first) this.select(first.pseudo.id);
  }

  protected create(): void {
    const result = this.store.create(this.query());
    if ('message' in result) {
      this.createRefusal.set(result.message);
      return;
    }
    this.createRefusal.set(undefined);
    this.select(result.id);
  }

  protected toggle(p: Pseudo, gameId: string, mine: boolean): void {
    if (mine) this.store.signOff(p.id, gameId);
    else this.refusal.set(this.store.signUp(p.id, gameId)?.message);
  }

  protected placedIn(p: Pseudo, slot: Slot, gameId: string): boolean {
    const r = p.results[slot.id];
    return !!r && r !== 'unplaced' && r.gameId === gameId;
  }

  protected resultText(p: Pseudo, slot: Slot): string {
    const led = this.store.leadsOn(p.id, slot.id);
    if (led) return `Mène ${led.title}`;
    const r = p.results[slot.id];
    if (r === 'unplaced') {
      const left = this.store.remaining(slot.id).map((x) => x.table);
      return `Non placé${left.length ? ` · reste : ${left.join(', ')}` : ''}`;
    }
    if (r) return `Table ${this.store.game(r.gameId).table}`;
    if (p.withoutGame.includes(slot.id)) return 'Sans partie';
    return '';
  }

  protected async merge(p: Pseudo) {
    const target = await this.gestures.merge(p);
    if (target) this.select(target);
  }

  protected async remove(p: Pseudo) {
    if (await this.gestures.remove(p)) this.selectedId.set(undefined);
  }

  protected async latecomer(p: Pseudo, slot: Slot) {
    this.refusal.set(await this.gestures.addLatecomer(p, slot.id));
  }
}
