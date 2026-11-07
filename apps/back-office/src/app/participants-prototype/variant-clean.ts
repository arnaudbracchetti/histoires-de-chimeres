/**
 * PROTOTYPE, à jeter (#135). Deuxième tour, à partir de A, plus épuré : une liste sobre, commune,
 * et trois façons de ranger la fiche (D, E, F). Une information à un seul endroit, des phrases
 * entières, pas de texte tronqué, peu de couleur.
 */
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatTime } from '@chimeres/design';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Gauge } from '../ui/gauge';
import { Icon } from '../ui/icon';
import { MoreMenu, type MoreMenuItem } from '../ui/more-menu';
import { PrototypeGestures, PseudoField } from './prototype-gestures';
import { PrototypeStore, type Pseudo, type Slot } from './prototype-data';

function slotTitle(slot: Slot): string {
  return `Créneau ${slot.rank} · ${formatTime(slot.start)}`;
}

/** Le résultat d'un pseudo sur un créneau, en deux lignes : l'essentiel, puis le détail. */
function result(store: PrototypeStore, p: Pseudo, slot: Slot): { main: string; sub?: string; alert?: boolean } {
  const led = store.leadsOn(p.id, slot.id);
  if (led) return { main: `Mène ${led.title}`, sub: `Table ${led.table}` };
  const r = p.results[slot.id];
  if (r === 'unplaced') {
    const left = store.remaining(slot.id);
    return {
      main: 'Non placé',
      sub: left.length
        ? `Il reste de la place à ${left.map((x) => `${x.table} (${x.remaining})`).join(', ')}.`
        : 'Il ne reste de place nulle part.',
      alert: true,
    };
  }
  if (r) {
    const g = store.game(r.gameId);
    return { main: `Table ${g.table}`, sub: `${g.title}, avec ${store.nickname(g.gameMasterId)}` };
  }
  if (p.withoutGame.includes(slot.id)) return { main: 'Sans partie', alert: true };
  return { main: 'Pas dans le tirage' };
}

function signUpCount(store: PrototypeStore, p: Pseudo, slot: Slot): number {
  return p.signUps.filter((id) => store.game(id).slotId === slot.id).length;
}

// ————— La liste, commune à D, E et F —————

@Component({
  selector: 'app-clean-list',
  imports: [Button, PageHeader, PseudoField, RouterLink],
  template: `
    <app-page-header title="Participants" />
    <div class="body">
      <ul class="legend" aria-label="États des créneaux">
        @for (slot of store.slots(); track slot.id) {
          <li [style.--st]="states[slot.state].color">
            <span class="dot"></span>Créneau {{ slot.rank }} · {{ states[slot.state].label.toLowerCase() }}
          </li>
        }
      </ul>
      <input
        #q
        type="search"
        placeholder="Pseudo, ou titre d’une partie"
        aria-label="Chercher un pseudo, ou une partie où il est inscrit"
        [value]="query()"
        (input)="query.set(q.value)"
      />
      <table>
        <thead>
          <tr>
            <th>Pseudo</th>
            <th class="per-slot">Inscriptions par créneau</th>
            <th class="n">Téléphones</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.pseudo.id) {
            <tr>
              <th scope="row">
                <a [routerLink]="['/participants', r.pseudo.id]" [queryParams]="{ variant: variant() }">{{
                  r.pseudo.nickname
                }}</a>
                @if (r.pseudo.kind === 'gm') {
                  <span class="muted">MJ</span>
                }
                @if (r.byGame) {
                  <span class="match">inscrit à {{ r.byGame }}</span>
                }
              </th>
              <td class="per-slot">
                <span class="visually-hidden">{{ perSlotText(r.pseudo) }}</span>
                @if (variant() === 'E3s') {
                  <span class="slashes" aria-hidden="true">
                    @for (c of perSlot(r.pseudo); track c.slot.id) {
                      <span [style.color]="c.color" [class.zero]="!c.count" [title]="c.title">{{ c.count }}</span>
                      @if (!$last) {
                        <span class="sep">/</span>
                      }
                    }
                  </span>
                } @else {
                  <span class="pips" aria-hidden="true">
                    @for (c of perSlot(r.pseudo); track c.slot.id) {
                      <span class="pip" [style.--st]="c.color" [class.filled]="c.count" [class.ended]="c.slot.state === 'ended'" [title]="c.title">{{ c.count }}</span>
                    }
                  </span>
                }
              </td>
              <td class="n">{{ r.pseudo.phones.length || '' }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="3" class="muted">Aucun pseudo ne correspond.</td>
            </tr>
          }
          @if (adding()) {
            <tr class="new">
              <td colspan="3">
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
        <button type="button" appButton="secondary" (click)="adding.set(true)">Créer un pseudo</button>
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
      input {
        width: 22rem;
      }
    }
    table {
      width: 44rem;
    }
    .per-slot { width: 14rem; }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs) var(--space-l);
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--text-muted);
      font-size: var(--font-size-meta);
      li { display: flex; gap: var(--space-xs); align-items: center; }
    }
    .dot {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--st);
    }
    .pips { display: flex; gap: var(--space-xs); }
    .pip {
      display: inline-grid;
      place-items: center;
      box-sizing: border-box;
      width: 1.5rem;
      height: 1.5rem;
      border: 1.5px solid var(--st);
      border-radius: 50%;
      color: var(--text-muted);
      font-size: var(--font-size-overline);
      font-variant-numeric: tabular-nums;
      &.filled {
        background: color-mix(in srgb, var(--st) 30%, transparent);
        color: var(--text);
        font-weight: 600;
      }
      &.ended { opacity: 0.6; }
    }
    .slashes {
      display: flex;
      gap: var(--space-xxs);
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      .zero { opacity: 0.45; font-weight: 400; }
      .sep { color: var(--engraving-strong); font-weight: 400; }
    }
    tr {
      height: 48px;
    }
    .n {
      width: 8rem;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    tbody tr:hover {
      background: var(--surface-1);
    }
    tbody th a {
      color: var(--text);
      font-weight: 600;
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
    .muted {
      margin-left: var(--space-xs);
      color: var(--text-muted);
      font-weight: 400;
    }
    .match {
      display: block;
      color: var(--text-muted);
      font-size: var(--font-size-meta);
      font-weight: 400;
    }
  `,
})
export class CleanList {
  readonly variant = input.required<string>();
  protected readonly store = inject(PrototypeStore);
  private readonly router = inject(Router);
  protected readonly query = signal('');
  protected readonly adding = signal(false);
  protected readonly rows = computed(() => this.store.search(this.query()));
  protected readonly states = SLOT_STATES;

  /** Le nombre d'inscriptions du pseudo sur chaque créneau, avec la couleur de l'état du créneau. */
  protected perSlot(p: Pseudo) {
    return this.store.slots().map((slot) => {
      const count = signUpCount(this.store, p, slot);
      const state = SLOT_STATES[slot.state];
      return {
        slot,
        count,
        color: state.color,
        title: `Créneau ${slot.rank} · ${state.label.toLowerCase()} : ${count} inscription${count > 1 ? 's' : ''}`,
      };
    });
  }

  protected perSlotText(p: Pseudo): string {
    return this.perSlot(p).map((c) => c.title).join(' ; ');
  }

  protected readonly create = (value: string) => {
    const r = this.store.create(value);
    if ('message' in r) return r;
    this.openSheet(r.id);
    return undefined;
  };

  protected openSheet(id: string): void {
    void this.router.navigate(['/participants', id], { queryParams: { variant: this.variant() } });
  }
}

// ————— L'en-tête de la fiche, commun à D, E et F —————

@Component({
  selector: 'app-clean-header',
  imports: [Button, Icon, MoreMenu, PageHeader, PseudoField],
  template: `
    <app-page-header
      [title]="pseudo().nickname"
      [trail]="[{ label: 'Participants', link: '/participants' }]"
      [titleHidden]="renaming()"
    >
      <ng-container ngProjectAs="[appPageTitle]">
        @if (renaming()) {
          <app-pseudo-field
            [initial]="pseudo().nickname"
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
        }
      </ng-container>
      <p ngProjectAs="[appPageSubtitle]" class="subtitle">{{ subtitle() }}</p>
      <app-more-menu label="Autres actions sur le pseudo" [items]="menu()" (selected)="onMenu($event)" />
    </app-page-header>
  `,
  styles: `
    .subtitle {
      margin: var(--space-xxs) 0 0;
      color: var(--text-muted);
    }
  `,
})
export class CleanHeader {
  readonly pseudo = input.required<Pseudo>();
  readonly variant = input.required<string>();
  /** Masque la ligne des téléphones dans le sous-titre, quand la fiche les montre ailleurs. */
  readonly withPhones = input(true);
  readonly cutLinks = output();
  private readonly store = inject(PrototypeStore);
  private readonly gestures = inject(PrototypeGestures);
  private readonly router = inject(Router);
  protected readonly renaming = signal(false);

  protected readonly rename = (value: string) => this.store.rename(this.pseudo().id, value);

  protected readonly subtitle = computed(() => {
    const p = this.pseudo();
    const kind = p.kind === 'gm' ? 'MJ' : 'Participant';
    if (!this.withPhones()) return kind;
    const n = p.phones.length;
    return `${kind} · ${n ? (n === 1 ? '1 téléphone relié' : `${n} téléphones reliés`) : 'aucun téléphone relié'}`;
  });

  protected readonly menu = computed(() => {
    const p = this.pseudo();
    const items: MoreMenuItem[] = [];
    if (p.phones.length) items.push({ value: 'cut', label: 'Couper les liens' });
    if (p.kind === 'participant') {
      items.push({ value: 'merge', label: 'Fusionner dans un autre pseudo…' });
      items.push({ value: 'remove', label: 'Supprimer le pseudo', danger: true });
    }
    return items;
  });

  protected go(id: string): void {
    this.renaming.set(false);
    void this.router.navigate(['/participants', id], { queryParams: { variant: this.variant() } });
  }

  protected async onMenu(value: string) {
    const p = this.pseudo();
    if (value === 'cut') await this.gestures.cutLinks(p);
    if (value === 'merge') {
      const target = await this.gestures.merge(p);
      if (target) this.go(target);
    }
    if (value === 'remove' && (await this.gestures.remove(p)))
      void this.router.navigate(['/participants'], { queryParams: { variant: this.variant() } });
  }
}

const SHARED_STYLES = `
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
    max-width: 48rem;
    padding: var(--space-l) var(--space-xl);
  }
  section {
    display: flex;
    flex-direction: column;
    gap: var(--space-s);
  }
  h2 {
    font-size: var(--font-size-section);
  }
  h3 {
    margin-top: var(--space-s);
    color: var(--text-muted);
    font-family: var(--font-ui);
    font-size: var(--font-size-meta);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  p {
    margin: 0;
  }
  .muted {
    color: var(--text-muted);
  }
  .meta {
    color: var(--text-muted);
    font-size: var(--font-size-meta);
  }
  .alert {
    color: var(--danger);
  }
  .row {
    display: flex;
    gap: var(--space-m);
    align-items: center;
    min-height: 48px;
    border-bottom: 1px solid var(--border);
  }
  .grow {
    flex: 1;
  }
`;

// ————— D : rubriques —————

/**
 * D, « Rubriques » : une seule colonne, trois rubriques l'une sous l'autre. Résultats des tirages
 * (une ligne par créneau tiré), Inscriptions (les créneaux ouverts seulement), Téléphones reliés.
 */
@Component({
  selector: 'app-sheet-d',
  imports: [Button, CleanHeader],
  template: `
    <app-clean-header [pseudo]="p()" variant="D" [withPhones]="false" />
    <div class="page">
      <section>
        <h2>Résultats des tirages</h2>
        <ul>
          @for (slot of drawn(); track slot.id) {
            @let r = result(slot);
            <li class="row">
              <span class="when muted">{{ slotTitle(slot) }}</span>
              <span class="grow">
                <span [class.alert]="r.alert">{{ r.main }}</span>
                @if (slot.state === 'provisional') {
                  <span class="meta"> · provisoire</span>
                }
                @if (r.sub) {
                  <span class="meta block">{{ r.sub }}</span>
                }
              </span>
              @if (canAddLatecomer(slot)) {
                <button type="button" appButton="quiet" (click)="latecomer(slot)">
                  Ajouter comme non placé
                </button>
              }
            </li>
          } @empty {
            <li class="muted">Aucun tirage lancé pour l’instant.</li>
          }
        </ul>
        @if (refusal(); as r) {
          <p class="alert">{{ r }}</p>
        }
      </section>

      <section>
        <h2>Inscriptions</h2>
        @for (slot of openSlots(); track slot.id) {
          <h3>{{ slotTitle(slot) }}</h3>
          @if (store.leadsOn(p().id, slot.id); as led) {
            <p class="meta">Mène {{ led.title }} : ses inscriptions sur ce créneau sont de secours.</p>
          }
          <ul>
            @for (line of lines(slot); track line.game.id) {
              @if (line.mine || adding() === slot.id) {
                <li class="row">
                  <span class="grow">{{ line.game.title }}</span>
                  <span class="meta">{{ line.signedUp }} inscrits pour {{ line.game.maxSeats }} places</span>
                  @if (line.ownGame) {
                    <span class="meta action">sa partie</span>
                  } @else if (line.mine) {
                    <button type="button" appButton="quiet" class="action" (click)="store.signOff(p().id, line.game.id)">
                      Désinscrire
                    </button>
                  } @else {
                    <button type="button" appButton="secondary" class="action" (click)="store.signUp(p().id, line.game.id)">
                      Inscrire
                    </button>
                  }
                </li>
              }
            }
          </ul>
          @if (p().withoutGame.includes(slot.id)) {
            <p class="alert">
              Sans partie sur ce créneau.
              <button type="button" appButton="quiet" (click)="store.withdraw(p().id, slot.id)">Retirer du tirage</button>
            </p>
          }
          @if (adding() === slot.id) {
            <button type="button" appButton="quiet" (click)="adding.set(undefined)">Fermer</button>
          } @else {
            <button type="button" appButton="quiet" class="more" (click)="adding.set(slot.id)">
              + Inscrire à une partie du créneau {{ slot.rank }}
            </button>
          }
        } @empty {
          <p class="muted">Aucun créneau n’a ses inscriptions ouvertes.</p>
        }
      </section>

      <section>
        <h2>Téléphones reliés</h2>
        <ul>
          @for (phone of p().phones; track $index) {
            <li class="row">Relié à {{ phone.linkedAt }}</li>
          } @empty {
            <li class="muted">Aucun téléphone relié : la personne lit ses résultats à l’accueil.</li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: SHARED_STYLES + `
    .when { width: 10rem; }
    .block { display: block; }
    .action { width: 7rem; justify-content: flex-end; text-align: right; }
    .more { align-self: flex-start; }
  `,
})
export class SheetD {
  readonly p = input.required<Pseudo>();
  protected readonly store = inject(PrototypeStore);
  private readonly gestures = inject(PrototypeGestures);
  protected readonly slotTitle = slotTitle;
  protected readonly adding = signal<string | undefined>(undefined);
  protected readonly refusal = signal<string | undefined>(undefined);
  protected readonly drawn = computed(() => this.store.slots().filter((s) => s.state !== 'open'));
  protected readonly openSlots = computed(() => this.store.slots().filter((s) => s.state === 'open'));

  protected result(slot: Slot) {
    return result(this.store, this.p(), slot);
  }
  protected lines(slot: Slot) {
    return this.store.lines(this.p(), slot.id);
  }
  protected canAddLatecomer(slot: Slot): boolean {
    return slot.state === 'published' && !this.p().results[slot.id] && !this.store.leadsOn(this.p().id, slot.id);
  }
  protected async latecomer(slot: Slot) {
    this.refusal.set(await this.gestures.addLatecomer(this.p(), slot.id));
  }
}

// ————— E : onglets —————

/**
 * Les quatre états d'un créneau, une couleur et une icône chacun, tirées de la charte : bleu (le
 * focus) pour ce qui est encore ouvert, orange et sablier pour le tirage provisoire (comme le
 * pilotage), vert et cadenas pour le publié, gris pour le terminé.
 */
const SLOT_STATES = {
  open: { label: 'Inscriptions ouvertes', icon: 'lock-open', color: 'var(--focus)' },
  provisional: { label: 'Tirage provisoire', icon: 'hourglass', color: 'var(--accent)' },
  published: { label: 'Tirage publié', icon: 'lock', color: 'var(--success)' },
  ended: { label: 'Terminé', icon: 'check', color: 'var(--text-muted)' },
} as const;

/**
 * E, « Onglets » : sous l'en-tête, trois onglets, une seule chose à la fois. « Programme » : une
 * ligne par créneau. « Inscriptions » : on choisit un créneau ouvert, puis on coche ses parties.
 * « Téléphones ».
 */
@Component({
  selector: 'app-sheet-e',
  imports: [Button, CleanHeader, Gauge, Icon],
  template: `
    <app-clean-header [pseudo]="p()" [variant]="key() || palette()" [withPhones]="false" />
    <div class="page">
      <div class="tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button type="button" role="tab" [attr.aria-selected]="tab() === t.key" (click)="tab.set(t.key)">
            {{ t.label }}
            @if (t.key === 'phones') {
              <span class="count">{{ p().phones.length }}</span>
            }
          </button>
        }
      </div>

      @switch (tab()) {
        @case ('program') {
          <ul>
            @for (slot of store.slots(); track slot.id) {
              @let r = result(slot);
              @let st = states[slot.state];
              <li class="row" [class]="'palette-' + palette() + ' st-' + slot.state" [style.--st]="st.color"
                [class.clickable]="actions() === 'b' && slot.state === 'open'"
                (click)="actions() === 'b' && slot.state === 'open' && openSignUps(slot)">
                @if (palette() === 'E3') {
                  <span class="node" aria-hidden="true"><app-icon [name]="st.icon" /></span>
                }
                <span class="when">
                  {{ slotTitle(slot) }}
                  @if (palette() === 'E1') {
                    <span class="badge"><app-icon [name]="st.icon" />{{ st.label }}</span>
                  } @else {
                    <span class="state-text">
                      @if (palette() === 'E2') {
                        <app-icon [name]="st.icon" />
                      }
                      {{ st.label }}
                    </span>
                  }
                </span>
                <span class="grow">
                  @if (slot.state === 'open') {
                    @let n = count(slot);
                    <span [class.muted]="!n">{{ n ? (n === 1 ? '1 inscription' : n + ' inscriptions') : 'Aucune inscription' }}</span>
                  } @else {
                    <span [class.alert]="r.alert">{{ r.main }}</span>
                    @if (r.sub) {
                      <span class="meta block">{{ r.sub }}</span>
                    }
                  }
                  @if (actions() === 'c') {
                    @if (slot.state === 'open') {
                      <button type="button" class="link" (click)="openSignUps(slot)">
                        {{ count(slot) ? 'Modifier les inscriptions' : 'Inscrire à une partie' }}
                        <app-icon name="chevron-right" />
                      </button>
                    } @else if (canAddLatecomer(slot)) {
                      <button type="button" class="link" (click)="latecomer(slot)">
                        Ajouter comme non placé <app-icon name="chevron-right" />
                      </button>
                    }
                  }
                </span>
                @switch (actions()) {
                  @case ('a') {
                    @if (slot.state === 'open') {
                      <button type="button" appButton="secondary" class="act" (click)="openSignUps(slot)">
                        <app-icon name="pencil" /> Modifier les inscriptions
                      </button>
                    } @else if (canAddLatecomer(slot)) {
                      <button type="button" appButton="secondary" class="act" (click)="latecomer(slot)">
                        <app-icon name="plus" /> Ajouter comme non placé
                      </button>
                    } @else if (canReopen(slot)) {
                      <button type="button" appButton="secondary" class="act" (click)="reopen(slot)">
                        <app-icon name="lock-open" /> Rouvrir les inscriptions
                      </button>
                    }
                  }
                  @case ('b') {
                    @if (slot.state === 'open') {
                      <span class="go">
                        Inscriptions <app-icon name="chevron-right" />
                      </span>
                    } @else if (canAddLatecomer(slot)) {
                      <button type="button" appButton="secondary" class="act" (click)="$event.stopPropagation(); latecomer(slot)">
                        <app-icon name="plus" /> Ajouter comme non placé
                      </button>
                    }
                  }
                  @case ('c') {}
                  @default {
                    @if (slot.state === 'open') {
                      <button type="button" appButton="quiet" (click)="openSignUps(slot)">Modifier</button>
                    } @else if (canAddLatecomer(slot)) {
                      <button type="button" appButton="quiet" (click)="latecomer(slot)">Ajouter comme non placé</button>
                    }
                  }
                }
              </li>
            }
          </ul>
          @if (refusal(); as r) {
            <p class="alert">{{ r }}</p>
          }
        }
        @case ('signups') {
          <div class="slots" role="radiogroup" aria-label="Créneau">
            @for (slot of openSlots(); track slot.id) {
              <button type="button" role="radio" [attr.aria-checked]="current()?.id === slot.id" (click)="slotId.set(slot.id)">
                {{ slotTitle(slot) }}
              </button>
            }
          </div>
          @if (current(); as slot) {
            @if (store.leadsOn(p().id, slot.id); as led) {
              <p class="meta">Mène {{ led.title }} : ses inscriptions sur ce créneau sont de secours.</p>
            }
            <ul>
              @for (line of store.lines(p(), slot.id); track line.game.id) {
                <li class="row">
                  <label class="grow check">
                    <input
                      type="checkbox"
                      [checked]="line.mine"
                      [disabled]="line.ownGame"
                      (change)="toggle(line.game.id, line.mine)"
                    />
                    {{ line.game.title }}
                    @if (line.ownGame) {
                      <span class="meta">· sa partie</span>
                    }
                  </label>
                  @let min = minOf(line.game.maxSeats);
                  <span class="figures">
                    <app-gauge [count]="line.signedUp" [min]="min" [max]="line.game.maxSeats" [shortfall]="line.signedUp < min" />
                    <span class="meta">
                      {{ line.signedUp }} {{ line.signedUp > 1 ? 'inscrits' : 'inscrit' }} · {{ min }} à {{ line.game.maxSeats }} places
                      @if (line.veryRequested) {
                        · <strong class="hot-text">très demandée</strong>
                      } @else if (line.signedUp < min) {
                        · <strong class="short-text">{{ min - line.signedUp }} {{ min - line.signedUp > 1 ? 'manquants' : 'manquant' }}</strong>
                      }
                    </span>
                  </span>
                </li>
              }
            </ul>
            @if (p().withoutGame.includes(slot.id)) {
              <p class="alert">
                Sans partie sur ce créneau.
                <button type="button" appButton="quiet" (click)="store.withdraw(p().id, slot.id)">Retirer du tirage</button>
              </p>
            }
          } @else {
            <p class="muted">Aucun créneau n’a ses inscriptions ouvertes.</p>
          }
        }
        @case ('phones') {
          <ul>
            @for (phone of p().phones; track $index) {
              <li class="row">Relié à {{ phone.linkedAt }}</li>
            } @empty {
              <li class="muted">Aucun téléphone relié : la personne lit ses résultats à l’accueil.</li>
            }
          </ul>
        }
      }
    </div>
  `,
  styles: SHARED_STYLES + `
    .page { gap: var(--space-l); }
    .act {
      flex: none;
      app-icon svg { width: 0.9rem; height: 0.9rem; }
    }
    .clickable {
      cursor: pointer;
      border-radius: var(--radius-control);
      &:hover { background: var(--surface-1); }
      &:hover .go { color: var(--accent); }
    }
    .go {
      display: inline-flex;
      gap: var(--space-xxs);
      align-items: center;
      padding-right: var(--space-s);
      color: var(--text);
      font-weight: 600;
    }
    .link {
      display: flex;
      gap: var(--space-xxs);
      align-items: center;
      margin-top: var(--space-xxs);
      padding: 0;
      border: none;
      background: none;
      color: var(--accent);
      font-weight: 600;
      cursor: pointer;
      &:hover { text-decoration: underline; }
      app-icon svg { width: 0.9rem; height: 0.9rem; }
    }
    .figures {
      display: flex;
      flex-direction: column;
      gap: var(--space-xxs);
      width: 17rem;
      padding-block: var(--space-s);
      app-gauge { margin-bottom: var(--space-xxs); }
    }
    .hot-text { color: var(--text); }
    .short-text { color: var(--warning); }
    /* L'état du créneau : sa couleur dans --st. */
    .badge {
      display: inline-flex;
      gap: var(--space-xxs);
      align-items: center;
      margin-top: var(--space-xxs);
      padding: 0 var(--space-s);
      border-radius: 999px;
      background: color-mix(in srgb, var(--st) 16%, transparent);
      color: var(--st);
      font-size: var(--font-size-meta);
      app-icon svg { width: 0.85rem; height: 0.85rem; }
    }
    .state-text {
      display: flex;
      gap: var(--space-xxs);
      align-items: center;
      color: var(--st);
      font-size: var(--font-size-meta);
      app-icon svg { width: 0.85rem; height: 0.85rem; }
    }
    .row.st-ended .grow, .row.st-ended .when { opacity: 0.6; }
    .row.st-ended .badge, .row.st-ended .state-text { opacity: 1; }
    .palette-E1, .palette-E3 { padding-block: var(--space-s); }
    .palette-E2 {
      margin-bottom: var(--space-xs);
      padding: var(--space-s) var(--space-m);
      border: none;
      border-left: 4px solid var(--st);
      border-radius: 0 var(--radius-control) var(--radius-control) 0;
      background: color-mix(in srgb, var(--st) 7%, transparent);
    }
    .palette-E3 {
      position: relative;
      border: none;
      .node {
        position: relative;
        z-index: 1;
        display: grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        border: 2px solid var(--st);
        border-radius: 50%;
        background: var(--surface-0);
        color: var(--st);
        app-icon svg { width: 0.85rem; height: 0.85rem; }
      }
      &::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: calc(0.875rem - 1px);
        border-left: 2px solid var(--engraving-strong);
      }
      &:first-child::before { top: 50%; }
      &:last-child::before { bottom: 50%; }
      &.st-open::before, &.st-provisional::before { border-left-style: dashed; }
      &.st-open .node { background: var(--surface-0); border-style: dashed; }
      &.st-published .node, &.st-ended .node { background: color-mix(in srgb, var(--st) 25%, var(--surface-0)); }
    }
    .when { width: 11rem; }
    .block { display: block; }
    .tabs, .slots {
      display: flex;
      gap: var(--space-l);
      border-bottom: 1px solid var(--border);
      button {
        padding: var(--space-s) 0;
        border: none;
        border-bottom: 2px solid transparent;
        background: none;
        color: var(--text-muted);
        cursor: pointer;
        &[aria-selected='true'], &[aria-checked='true'] {
          border-bottom-color: var(--accent);
          color: var(--text);
        }
      }
    }
    .slots {
      gap: var(--space-s);
      border: none;
      button {
        padding: var(--space-xs) var(--space-m);
        border: 1px solid var(--border);
        border-radius: 999px;
        &[aria-checked='true'] { border-color: var(--accent); }
      }
    }
    .count {
      margin-left: var(--space-xxs);
      color: var(--text-muted);
      font-size: var(--font-size-meta);
    }
    .check { display: flex; gap: var(--space-s); align-items: center; }
    .hot { width: 7rem; color: var(--warning); text-align: right; }
  `,
})
export class SheetE {
  readonly p = input.required<Pseudo>();
  /** Le code des états dans « Programme » : E1 badges, E2 liserés, E3 frise. */
  readonly palette = input('E1');
  /** Les boutons de droite dans « Programme » : a boutons explicites, b ligne cliquable, c lien sous le résultat. */
  readonly actions = input<'' | 'a' | 'b' | 'c'>('');
  readonly key = input('');
  protected readonly states = SLOT_STATES;
  protected readonly store = inject(PrototypeStore);
  private readonly gestures = inject(PrototypeGestures);
  protected readonly slotTitle = slotTitle;
  protected readonly tabs = [
    { key: 'program', label: 'Programme' },
    { key: 'signups', label: 'Inscriptions' },
    { key: 'phones', label: 'Téléphones' },
  ];
  protected readonly tab = signal('program');
  protected readonly openSlots = computed(() => this.store.slots().filter((s) => s.state === 'open'));
  protected readonly slotId = signal<string | undefined>(undefined);
  protected readonly current = computed(
    () => this.openSlots().find((s) => s.id === this.slotId()) ?? this.openSlots()[0],
  );
  protected readonly refusal = signal<string | undefined>(undefined);

  protected result(slot: Slot) {
    return result(this.store, this.p(), slot);
  }
  protected count(slot: Slot) {
    return signUpCount(this.store, this.p(), slot);
  }
  /** Minimum de places, inventé pour le prototype : deux de moins que le maximum, deux au moins. */
  protected minOf(max: number): number {
    return Math.max(2, max - 2);
  }
  protected stateLabel(slot: Slot): string {
    return { open: 'inscriptions ouvertes', provisional: 'tirage provisoire', published: 'tirage publié', ended: 'terminé' }[slot.state];
  }
  protected openSignUps(slot: Slot): void {
    this.slotId.set(slot.id);
    this.tab.set('signups');
  }
  protected toggle(gameId: string, mine: boolean): void {
    if (mine) this.store.signOff(this.p().id, gameId);
    else this.store.signUp(this.p().id, gameId);
  }
  protected canAddLatecomer(slot: Slot): boolean {
    return slot.state === 'published' && !this.p().results[slot.id] && !this.store.leadsOn(this.p().id, slot.id);
  }
  /** Tirage provisoire où le pseudo n'est pas : on rouvre pour l'inscrire (§4.5, TI-6). */
  protected canReopen(slot: Slot): boolean {
    return slot.state === 'provisional' && !this.p().results[slot.id] && !this.store.leadsOn(this.p().id, slot.id);
  }
  protected async reopen(slot: Slot) {
    await this.gestures.reopen(slot.id);
  }
  protected async latecomer(slot: Slot) {
    this.refusal.set(await this.gestures.addLatecomer(this.p(), slot.id));
  }
}

// ————— F : une ligne par créneau, inscriptions sur leur propre écran —————

/**
 * F, « Une ligne par créneau » : la fiche n'est qu'une liste, un créneau par ligne, avec une
 * phrase et au plus un bouton. Les inscriptions d'un créneau s'ouvrent sur leur propre écran
 * (« Élodie › Créneau 4 »), qui ne montre que les parties de ce créneau.
 */
@Component({
  selector: 'app-sheet-f',
  imports: [Button, CleanHeader, PageHeader],
  template: `
    @if (slot(); as s) {
      <app-page-header
        [title]="'Inscriptions au créneau ' + s.rank"
        [trail]="[
          { label: 'Participants', link: '/participants' },
          { label: p().nickname, link: '/participants/' + p().id },
        ]"
      >
        <button type="button" appButton="primary" (click)="slotId.set(undefined)">Terminé</button>
      </app-page-header>
      <div class="page">
        <p class="muted">
          {{ p().nickname }}, {{ slotTitle(s) }}. Coche les parties où l’inscrire : c’est enregistré aussitôt.
        </p>
        @if (store.leadsOn(p().id, s.id); as led) {
          <p class="meta">Mène {{ led.title }} : ses inscriptions sur ce créneau sont de secours.</p>
        }
        <ul>
          @for (line of store.lines(p(), s.id); track line.game.id) {
            <li class="row">
              <label class="grow check">
                <input type="checkbox" [checked]="line.mine" [disabled]="line.ownGame" (change)="toggle(line.game.id, line.mine)" />
                <span>
                  {{ line.game.title }}
                  <span class="meta block">{{ line.gameMaster }} · table {{ line.game.table }}{{ line.double ? ' · partie double' : '' }}</span>
                </span>
              </label>
              <span class="meta">{{ line.signedUp }} inscrits pour {{ line.game.maxSeats }} places</span>
              <span class="meta hot">{{ line.veryRequested ? 'très demandée' : line.ownGame ? 'sa partie' : '' }}</span>
            </li>
          }
        </ul>
        @if (p().withoutGame.includes(s.id)) {
          <p class="alert">
            Sans partie sur ce créneau.
            <button type="button" appButton="quiet" (click)="store.withdraw(p().id, s.id)">Retirer du tirage</button>
          </p>
        }
      </div>
    } @else {
      <app-clean-header [pseudo]="p()" variant="F" />
      <div class="page">
        <ul>
          @for (slot of store.slots(); track slot.id) {
            @let r = result(slot);
            <li class="row tall" [class.past]="slot.state === 'ended'">
              <span class="when">
                {{ slotTitle(slot) }}
                <span class="meta block">{{ stateLabel(slot) }}</span>
              </span>
              <span class="grow">
                @if (slot.state === 'open') {
                  @let titles = signedTitles(slot);
                  @if (titles) {
                    Inscrit à {{ titles }}
                  } @else {
                    <span class="muted">Aucune inscription</span>
                  }
                } @else {
                  <span [class.alert]="r.alert">{{ r.main }}</span>
                  @if (r.sub) {
                    <span class="meta block">{{ r.sub }}</span>
                  }
                }
              </span>
              @if (slot.state === 'open') {
                <button type="button" appButton="secondary" (click)="slotId.set(slot.id)">Inscriptions</button>
              } @else if (canAddLatecomer(slot)) {
                <button type="button" appButton="secondary" (click)="latecomer(slot)">Ajouter comme non placé</button>
              }
            </li>
          }
        </ul>
        @if (refusal(); as r) {
          <p class="alert">{{ r }}</p>
        }
        @if (p().phones.length) {
          <p class="meta">
            Téléphones reliés à
            @for (phone of p().phones; track $index) {
              {{ phone.linkedAt }}{{ $last ? '.' : ', ' }}
            }
          </p>
        }
      </div>
    }
  `,
  styles: SHARED_STYLES + `
    .tall { min-height: 64px; }
    .past { opacity: 0.55; }
    .when { width: 11rem; }
    .block { display: block; }
    .check { display: flex; gap: var(--space-s); align-items: center; }
    .hot { width: 7rem; color: var(--warning); text-align: right; }
  `,
})
export class SheetF {
  readonly p = input.required<Pseudo>();
  protected readonly store = inject(PrototypeStore);
  private readonly gestures = inject(PrototypeGestures);
  protected readonly slotTitle = slotTitle;
  protected readonly formatTime = formatTime;
  protected readonly slotId = signal<string | undefined>(undefined);
  protected readonly slot = computed(() => (this.slotId() ? this.store.slot(this.slotId()!) : undefined));
  protected readonly refusal = signal<string | undefined>(undefined);

  protected result(slot: Slot) {
    return result(this.store, this.p(), slot);
  }
  protected stateLabel(slot: Slot): string {
    return { open: 'inscriptions ouvertes', provisional: 'tirage provisoire', published: 'tirage publié', ended: 'terminé' }[slot.state];
  }
  protected signedTitles(slot: Slot): string {
    return this.p()
      .signUps.map((id) => this.store.game(id))
      .filter((g) => g.slotId === slot.id)
      .map((g) => g.title)
      .join(', ');
  }
  protected toggle(gameId: string, mine: boolean): void {
    if (mine) this.store.signOff(this.p().id, gameId);
    else this.store.signUp(this.p().id, gameId);
  }
  protected canAddLatecomer(slot: Slot): boolean {
    return slot.state === 'published' && !this.p().results[slot.id] && !this.store.leadsOn(this.p().id, slot.id);
  }
  protected async latecomer(slot: Slot) {
    this.refusal.set(await this.gestures.addLatecomer(this.p(), slot.id));
  }
}

/** Monte la liste ou la fiche de la variante D, E ou F. */
@Component({
  selector: 'app-clean-variant',
  imports: [CleanList, SheetD, SheetE, SheetF],
  template: `
    @if (id()) {
      @if (pseudo(); as p) {
        @switch (variant()) {
          @case ('E') {
            <app-sheet-e [p]="p" palette="E1" />
          }
          @case ('E1') {
            <app-sheet-e [p]="p" palette="E1" />
          }
          @case ('E2') {
            <app-sheet-e [p]="p" palette="E2" />
          }
          @case ('E3') {
            <app-sheet-e [p]="p" palette="E3" />
          }
          @case ('E3a') {
            <app-sheet-e [p]="p" palette="E3" actions="a" key="E3a" />
          }
          @case ('E3s') {
            <app-sheet-e [p]="p" palette="E3" actions="a" key="E3s" />
          }
          @case ('E3b') {
            <app-sheet-e [p]="p" palette="E3" actions="b" key="E3b" />
          }
          @case ('E3c') {
            <app-sheet-e [p]="p" palette="E3" actions="c" key="E3c" />
          }
          @case ('F') {
            <app-sheet-f [p]="p" />
          }
          @default {
            <app-sheet-d [p]="p" />
          }
        }
      } @else {
        <p class="gone">Ce pseudo n’existe plus.</p>
      }
    } @else {
      <app-clean-list [variant]="variant()" />
    }
  `,
  styles: `.gone { padding: var(--space-xl); color: var(--text-muted); }`,
})
export class CleanVariant {
  readonly variant = input.required<string>();
  readonly id = input<string>();
  private readonly store = inject(PrototypeStore);
  protected readonly pseudo = computed(() => this.store.find(this.id()));
}
