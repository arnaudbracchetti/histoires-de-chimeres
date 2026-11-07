/**
 * PROTOTYPE, à jeter (#135). Variante C, « Guichet » : pensée pour l'accueil. Un seul grand champ
 * de recherche ; la fiche se lit comme un billet, une colonne par créneau avec le résultat en gros,
 * à lire à la personne. Les inscriptions d'un créneau ouvert se font dans un panneau latéral qui
 * montre le programme du créneau. Tous les autres gestes sont dans « ⋯ ».
 */
import { Component, computed, inject, signal } from '@angular/core';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { MoreMenu, type MoreMenuItem } from '../ui/more-menu';
import { PrototypeGestures, PseudoField } from './prototype-gestures';
import { PrototypeStore, STATE_LABELS, type Pseudo, type Slot } from './prototype-data';

@Component({
  selector: 'app-variant-c',
  imports: [Button, Icon, MoreMenu, PageHeader, PseudoField],
  template: `
    <app-page-header title="Participants">
      @if (!creating()) {
        <button type="button" appButton="primary" (click)="creating.set(true)">Nouveau pseudo</button>
      }
    </app-page-header>
    <div class="desk">
      @if (creating()) {
        <div class="create">
          <app-pseudo-field
            label="Pseudo de la personne"
            action="Créer"
            [run]="create"
            (cancelled)="creating.set(false)"
            (open)="select($event)"
          />
        </div>
      }
      <div class="search">
        <input
          #q
          type="search"
          placeholder="Pseudo, ou titre d’une partie où il est inscrit"
          aria-label="Chercher un pseudo, ou une partie où il est inscrit"
          [value]="query()"
          (input)="query.set(q.value); open.set(true)"
          (focus)="open.set(true)"
          (keydown.enter)="enter()"
          (keydown.escape)="open.set(false)"
        />
        @if (open() && query().trim()) {
          <ul class="suggest">
            @for (r of results(); track r.pseudo.id) {
              <li (mousedown)="select(r.pseudo.id)">
                <strong>{{ r.pseudo.nickname }}</strong>
                @if (r.pseudo.kind === 'gm') {
                  <span class="tag">MJ</span>
                }
                @if (r.byGame) {
                  <span class="sub">inscrit à {{ r.byGame }}</span>
                }
              </li>
            } @empty {
              <li class="sub">Aucun pseudo. « Nouveau pseudo » pour le créer.</li>
            }
          </ul>
        }
      </div>

      @if (selected(); as p) {
        <div class="ticket">
          <div class="who">
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
              <span class="phones">
                {{ p.phones.length ? p.phones.length + ' téléphone(s) relié(s)' : 'sans téléphone' }}
              </span>
              <app-more-menu
                label="Actions sur le pseudo"
                [items]="menuFor(p)"
                (selected)="onMenu($event, p)"
              />
            }
          </div>
          <ol class="columns">
            @for (slot of store.slots(); track slot.id) {
              <li [class]="slot.state" [class.active]="drawer() === slot.id">
                <span class="overline">Créneau {{ slot.rank }} · {{ slot.start }}</span>
                <span class="state">{{ labels[slot.state] }}</span>
                <span class="big">{{ big(p, slot) }}</span>
                <span class="small">{{ small(p, slot) }}</span>
                @if (slot.state === 'open') {
                  <button type="button" appButton="secondary" (click)="drawer.set(slot.id)">
                    Inscriptions ({{ countOn(p, slot) }})
                  </button>
                }
                @if (slot.state === 'published' && !p.results[slot.id] && !store.leadsOn(p.id, slot.id)) {
                  <button type="button" appButton="secondary" (click)="latecomer(p, slot)">
                    Ajouter, non placé
                  </button>
                }
              </li>
            }
          </ol>
          @if (refusal(); as r) {
            <p class="refusal">{{ r }}</p>
          }
          @if (p.phones.length) {
            <details>
              <summary>Téléphones reliés</summary>
              <ul>
                @for (phone of p.phones; track $index) {
                  <li>Relié à {{ phone.linkedAt }}</li>
                }
              </ul>
            </details>
          }
        </div>
      } @else {
        <p class="empty">
          <app-icon name="user-round" /> Cherche la personne : par son pseudo, ou par une partie où
          elle s’est inscrite.
        </p>
      }
    </div>

    @if (drawer() && selected(); as p) {
      <aside class="drawer" aria-label="Inscriptions du créneau">
        <header>
          <h3>Créneau {{ store.slot(drawer()!).rank }} · inscriptions de {{ p.nickname }}</h3>
          <button type="button" appButton="icon" aria-label="Fermer" (click)="drawer.set(undefined)">
            <app-icon name="x" />
          </button>
        </header>
        @for (line of store.lines(p, drawer()!); track line.game.id) {
          <label class="game" [class.on]="line.mine">
            <input
              type="checkbox"
              [checked]="line.mine"
              [disabled]="line.ownGame"
              (change)="toggle(p, line.game.id, line.mine)"
            />
            <span class="title">
              {{ line.game.title }}
              @if (line.double) {
                <span class="tag">double</span>
              }
              <span class="sub">{{ line.gameMaster }} · table {{ line.game.table }}</span>
            </span>
            <span class="ratio" [class.hot]="line.veryRequested">
              {{ line.signedUp }} / {{ line.game.maxSeats }}
              @if (line.veryRequested) {
                <span class="sub hot"><app-icon name="triangle-alert" /> très demandée</span>
              }
              @if (line.ownGame) {
                <span class="sub">sa partie</span>
              } @else if (line.backup) {
                <span class="sub">en secours</span>
              }
            </span>
          </label>
        }
        @if (p.withoutGame.includes(drawer()!)) {
          <p class="refusal">
            Sans partie sur ce créneau.
            <button type="button" appButton="quiet" (click)="store.withdraw(p.id, drawer()!)">
              Retirer du tirage
            </button>
          </p>
        }
      </aside>
    }
  `,
  styles: `
    .desk {
      display: flex;
      flex-direction: column;
      gap: var(--space-l);
      padding: var(--space-l) var(--space-xl);
    }
    .search {
      position: relative;
      input {
        width: 40rem;
        height: 3rem;
        font-size: var(--font-size-block);
      }
    }
    .suggest {
      position: absolute;
      top: calc(100% + 4px);
      z-index: 5;
      width: 40rem;
      margin: 0;
      padding: var(--space-xs);
      list-style: none;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface-2);
      li {
        display: flex;
        gap: var(--space-s);
        align-items: baseline;
        padding: var(--space-xs) var(--space-s);
        cursor: pointer;
        &:hover {
          background: var(--surface-3);
        }
      }
    }
    .tag {
      padding: 0 var(--space-xs);
      border-radius: 999px;
      background: var(--surface-3);
      color: var(--text-muted);
      font-size: var(--font-size-overline);
    }
    .sub {
      color: var(--text-muted);
      font-size: var(--font-size-overline);
    }
    .ticket {
      display: flex;
      flex-direction: column;
      gap: var(--space-m);
    }
    .who {
      display: flex;
      gap: var(--space-s);
      align-items: center;
      h2 {
        font-family: var(--font-display);
        font-size: var(--font-size-title);
      }
    }
    .phones {
      color: var(--text-muted);
    }
    .columns {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--space-s);
      margin: 0;
      padding: 0;
      list-style: none;
      li {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        align-items: flex-start;
        min-height: 12rem;
        padding: var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-1);
        &.ended {
          opacity: 0.55;
        }
        &.active {
          border-color: var(--accent);
          box-shadow: var(--halo);
        }
      }
    }
    .overline {
      color: var(--text-muted);
      font-size: var(--font-size-overline);
      text-transform: uppercase;
    }
    .state {
      font-size: var(--font-size-overline);
    }
    .open .state {
      color: var(--success);
    }
    .provisional .state {
      color: var(--warning);
    }
    .big {
      font-size: var(--font-size-section);
      font-weight: 600;
    }
    .small {
      flex: 1;
      color: var(--text-muted);
      font-size: var(--font-size-meta);
    }
    .refusal {
      color: var(--danger);
    }
    .empty {
      display: flex;
      gap: var(--space-s);
      color: var(--text-muted);
    }
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      width: 30rem;
      padding: var(--space-l);
      overflow: auto;
      border-left: 1px solid var(--border);
      background: var(--surface-2);
      box-shadow: -8px 0 24px rgb(0 0 0 / 0.4);
      header {
        display: flex;
        justify-content: space-between;
        margin-bottom: var(--space-s);
      }
      h3 {
        font-size: var(--font-size-block);
      }
    }
    .game {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: var(--space-s);
      align-items: start;
      padding: var(--space-s);
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      cursor: pointer;
      &.on {
        border-color: var(--accent);
      }
      .title {
        display: flex;
        flex-direction: column;
      }
    }
    .ratio {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      font-variant-numeric: tabular-nums;
      &.hot,
      .hot {
        color: var(--warning);
      }
    }
  `,
})
export class VariantC {
  protected readonly store = inject(PrototypeStore);
  protected readonly gestures = inject(PrototypeGestures);
  protected readonly labels = STATE_LABELS;
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly creating = signal(false);
  protected readonly renaming = signal(false);
  protected readonly selectedId = signal<string | undefined>('p-mamie');
  protected readonly drawer = signal<string | undefined>(undefined);
  protected readonly refusal = signal<string | undefined>(undefined);
  protected readonly results = computed(() => this.store.search(this.query()).slice(0, 8));
  protected readonly selected = computed(() => this.store.find(this.selectedId()));

  protected readonly rename = (value: string) => this.store.rename(this.selectedId()!, value);
  protected readonly create = (value: string) => {
    const result = this.store.create(value);
    if ('message' in result) return result;
    this.creating.set(false);
    this.select(result.id);
    return undefined;
  };

  protected menuFor(p: Pseudo): MoreMenuItem[] {
    const items: MoreMenuItem[] = [{ value: 'rename', label: 'Renommer' }];
    if (p.phones.length) items.push({ value: 'cut', label: 'Couper les liens' });
    if (p.kind === 'participant') {
      items.push({ value: 'merge', label: 'Fusionner dans un autre pseudo…' });
      items.push({ value: 'remove', label: 'Supprimer le pseudo', danger: true });
    }
    return items;
  }

  protected select(id: string): void {
    this.selectedId.set(id);
    this.query.set('');
    this.open.set(false);
    this.creating.set(false);
    this.renaming.set(false);
    this.drawer.set(undefined);
    this.refusal.set(undefined);
  }

  protected enter(): void {
    const first = this.results()[0];
    if (first) this.select(first.pseudo.id);
  }

  protected big(p: Pseudo, slot: Slot): string {
    const led = this.store.leadsOn(p.id, slot.id);
    if (led) return `Mène, table ${led.table}`;
    const r = p.results[slot.id];
    if (r === 'unplaced') return 'Pas de place';
    if (r) return `Table ${this.store.game(r.gameId).table}`;
    if (p.withoutGame.includes(slot.id)) return 'Sans partie';
    if (slot.state === 'open') return this.countOn(p, slot) ? 'Inscrit' : '—';
    return '—';
  }

  protected small(p: Pseudo, slot: Slot): string {
    const led = this.store.leadsOn(p.id, slot.id);
    if (led) return led.title;
    const r = p.results[slot.id];
    if (r === 'unplaced') {
      const left = this.store.remaining(slot.id);
      return left.length
        ? `Reste de la place : ${left.map((x) => `${x.table} (${x.remaining})`).join(', ')}`
        : 'Plus aucune place.';
    }
    if (r) {
      const g = this.store.game(r.gameId);
      return `${g.title}, avec ${this.store.nickname(g.gameMasterId)}${slot.state === 'provisional' ? ' (provisoire)' : ''}`;
    }
    if (slot.state === 'open')
      return p.signUps
        .map((id) => this.store.game(id))
        .filter((g) => g.slotId === slot.id)
        .map((g) => g.title)
        .join(', ');
    if (slot.state === 'provisional') return 'Inscriptions fermées.';
    return 'Pas dans ce tirage.';
  }

  protected countOn(p: Pseudo, slot: Slot): number {
    return p.signUps.filter((id) => this.store.game(id).slotId === slot.id).length;
  }

  protected toggle(p: Pseudo, gameId: string, mine: boolean): void {
    if (mine) this.store.signOff(p.id, gameId);
    else this.refusal.set(this.store.signUp(p.id, gameId)?.message);
  }

  protected async latecomer(p: Pseudo, slot: Slot) {
    this.refusal.set(await this.gestures.addLatecomer(p, slot.id));
  }

  protected async onMenu(value: string, p: Pseudo) {
    if (value === 'rename') this.renaming.set(true);
    if (value === 'cut') await this.gestures.cutLinks(p);
    if (value === 'merge') {
      const target = await this.gestures.merge(p);
      if (target) this.select(target);
    }
    if (value === 'remove' && (await this.gestures.remove(p))) this.selectedId.set(undefined);
  }
}
