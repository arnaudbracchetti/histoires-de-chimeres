import { Component, computed, inject, input, signal } from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { RouterLink } from '@angular/router';
import {
  gameMasterEndpoints,
  scenarioEndpoints,
  type GameMasterSheetDto,
  type ScenarioListItemDto,
} from '@chimeres/contract';
import { formatConventionDate, formatSeats, timeSlotLabel } from '@chimeres/design';
import { apiResource, currentValue } from '../api-resource';
import { ConventionStore } from '../convention/convention-store';
import { AvailabilityTimeline } from '../game-masters/availability-timeline';
import { formatScenarioDuration } from '../scenarios/scenario-format';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { ScenarioIllustration } from '../ui/scenario-illustration';
import { PrototypeState } from './prototype-state';

/** La fiche du MJ « connecté », relue quand il change. */
function mySheet() {
  const state = inject(PrototypeState);
  const resource = apiResource(gameMasterEndpoints.read, () => {
    const me = state.me();
    return me ? { gameMasterId: me.id } : undefined;
  });
  return { resource, sheet: currentValue(resource) };
}

const PAGE_STYLES = `
  @layer components {
    .body {
      display: flex;
      flex-direction: column;
      gap: var(--space-xl);
      padding: var(--space-l) var(--space-xl) 6rem;
    }
    .narrow { max-width: var(--content-width); margin-inline: auto; width: 100%; }
    section { display: flex; flex-direction: column; gap: var(--space-m); }
    h2 { font-size: var(--font-size-section); }
    .none, .meta { color: var(--text-muted); }
    .rows { margin: 0; padding: 0; list-style: none; }
    .rows li {
      display: flex; gap: var(--space-l); align-items: center;
      min-height: 48px; border-bottom: 1px solid var(--border);
    }
    .rows a { font-weight: 600; }
    app-scenario-illustration { width: 32px; flex: none; }
    .mine { color: var(--accent); font-size: var(--font-size-meta); }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: var(--space-m); }
    .card {
      display: flex; flex-direction: column; gap: var(--space-xs);
      padding: var(--space-m); border: 1px solid var(--border);
      border-radius: var(--radius-card); background: var(--surface-1);
    }
    .card .big { font-family: var(--font-display); font-size: var(--font-size-title); }
    .todo { color: var(--warning); }
    .done { color: var(--success); }
    .chips { display: flex; gap: var(--space-xs); }
    .chips button {
      padding: var(--space-xs) var(--space-m); border: 1px solid var(--border);
      border-radius: 999px; background: var(--surface-1); color: var(--text); cursor: pointer;
    }
    .chips button.on { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
    .note {
      padding: var(--space-s) var(--space-m); border: 1px dashed var(--border);
      color: var(--text-muted); font-size: var(--font-size-meta);
    }
  }
`;

/**
 * PROTOTYPE JETABLE (#171) : la fiche du MJ vue par lui-même. Sans crayon sur le pseudo (§8 :
 * seul un Organisateur le change), sans « Supprimer le MJ », sans fil d'Ariane vers la liste des
 * MJ. `only` restreint à une section (variante C). En variante B, la page porte aussi le
 * catalogue des scénarios de la convention.
 */
@Component({
  selector: 'app-proto-my-sheet',
  imports: [
    AvailabilityTimeline,
    Button,
    Icon,
    Loadable,
    PageHeader,
    RouterLink,
    ScenarioIllustration,
    Tab,
    TabContent,
    TabList,
    TabPanel,
    Tabs,
  ],
  template: `
    <app-page-header [title]="title()">
      @if (sheet(); as me) {
        @if (only() !== 'availabilities' && state.variant() !== 'A') {
          <a appButton="primary" [routerLink]="['/mj', me.id, 'nouveau-scenario']">Proposer un scénario</a>
        }
      }
    </app-page-header>
    <app-loadable [resource]="resource" failure="Impossible de charger ta fiche.">
      @if (sheet(); as me) {
        @if (state.variant() === 'A' && !only()) {
        <div class="body">
          <div ngTabs class="binder">
            <div ngTabList aria-label="Vues de ma fiche" [(selectedTab)]="selectedTab">
              <button ngTab id="tab-scenarios" type="button" value="scenarios">
                <app-icon name="book-open" />Mes scénarios
                <span class="count">{{ me.scenarios.length }}</span>
              </button>
              <button ngTab id="tab-availabilities" type="button" value="availabilities">
                <app-icon name="clock" />Mes disponibilités
                <span class="count">{{ me.availabilities.length }} / {{ store.timeSlots().length }}</span>
              </button>
              <button ngTab id="tab-games" type="button" value="games">
                <app-icon name="dices" />Mes parties
                <span class="count">{{ me.games.length }}</span>
              </button>
            </div>
            <div ngTabPanel value="games" class="panel">
              <ng-template ngTabContent>
                @if (me.games.length) {
                  <ul class="rows">
                    @for (game of me.games; track game.gameId + game.timeSlotId) {
                      <li>
                        <span class="meta">{{ slotLabel(game.timeSlotId) }}</span>
                        <a [routerLink]="['/scenarios', game.scenario.id]">{{ game.scenario.title }}</a>
                        <span class="meta">{{ game.table.name }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="none">Aucune partie programmée pour l'instant.</p>
                }
              </ng-template>
            </div>
            <div ngTabPanel value="availabilities" class="panel">
              <ng-template ngTabContent>
                @if (store.timeSlots().length) {
                  <app-availability-timeline
                    [gameMaster]="me"
                    [timeSlots]="store.timeSlots()"
                    (changed)="resource.set($event)"
                    (refused)="resource.reload()"
                  />
                } @else {
                  <p class="none">Les créneaux de la journée ne sont pas encore définis.</p>
                }
              </ng-template>
            </div>
            <div ngTabPanel value="scenarios" class="panel">
              <ng-template ngTabContent>
                <div class="panel-actions">
                  <a appButton="primary" [routerLink]="['/mj', me.id, 'nouveau-scenario']">
                    <app-icon name="plus" />Proposer un scénario
                  </a>
                </div>
                <ul class="rows">
                  @for (scenario of me.scenarios; track scenario.id) {
                    <li>
                      <app-scenario-illustration [title]="scenario.title" [imageUrl]="scenario.imageUrl" />
                      <a [routerLink]="['/scenarios', scenario.id]">{{ scenario.title }}</a>
                      <span class="meta">{{ scenario.system }}</span>
                      <span class="meta">{{ formatSeats(scenario.seats) }}</span>
                      <span class="meta">{{ formatScenarioDuration(scenario.duration) }}</span>
                    </li>
                  } @empty {
                    <li class="none">Aucun scénario pour l'instant&nbsp;: propose le premier.</li>
                  }
                </ul>
              </ng-template>
            </div>
          </div>
        </div>
        } @else {
        <div class="body" [class.narrow]="state.variant() === 'B'">
          @if (!only()) {
            <section>
              <h2>Mes parties</h2>
              @if (me.games.length) {
                <ul class="rows">
                  @for (game of me.games; track game.gameId + game.timeSlotId) {
                    <li>
                      <span class="meta">{{ slotLabel(game.timeSlotId) }}</span>
                      <a [routerLink]="['/scenarios', game.scenario.id]">{{ game.scenario.title }}</a>
                      <span class="meta">{{ game.table.name }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="none">Aucune partie programmée pour l'instant.</p>
              }
            </section>
          }
          @if (only() !== 'scenarios') {
            <section>
              <h2>Mes disponibilités</h2>
              @if (store.timeSlots().length) {
                <app-availability-timeline
                  [gameMaster]="me"
                  [timeSlots]="store.timeSlots()"
                  (changed)="resource.set($event)"
                  (refused)="resource.reload()"
                />
              } @else {
                <p class="none">Les créneaux de la journée ne sont pas encore définis.</p>
              }
            </section>
          }
          @if (only() !== 'availabilities') {
            <section>
              <h2>Mes scénarios</h2>
              <ul class="rows">
                @for (scenario of me.scenarios; track scenario.id) {
                  <li>
                    <app-scenario-illustration [title]="scenario.title" [imageUrl]="scenario.imageUrl" />
                    <a [routerLink]="['/scenarios', scenario.id]">{{ scenario.title }}</a>
                    <span class="meta">{{ scenario.system }}</span>
                    <span class="meta">{{ formatSeats(scenario.seats) }}</span>
                    <span class="meta">{{ formatScenarioDuration(scenario.duration) }}</span>
                  </li>
                } @empty {
                  <li class="none">Aucun scénario pour l'instant.</li>
                }
              </ul>
            </section>
          }
          @if (state.variant() === 'B' && !only()) {
            <section>
              <h2>Scénarios de la convention</h2>
              <p class="meta">Ce que proposent les autres MJ, en lecture.</p>
              <ul class="rows">
                @for (scenario of others(); track scenario.id) {
                  <li>
                    <app-scenario-illustration [title]="scenario.title" [imageUrl]="scenario.imageUrl" />
                    <a [routerLink]="['/scenarios', scenario.id]">{{ scenario.title }}</a>
                    <span class="meta">{{ scenario.gameMaster.nickname }}</span>
                    <span class="meta">{{ scenario.system }}</span>
                  </li>
                } @empty {
                  <li class="none">Aucun autre scénario pour l'instant.</li>
                }
              </ul>
            </section>
          }
        </div>
        }
      }
    </app-loadable>
  `,
  styles:
    PAGE_STYLES +
    `app-availability-timeline { max-width: none; }
     .panel-actions { display: flex; justify-content: flex-end; margin-bottom: var(--space-m); }
     .panel-actions a { gap: var(--space-xs); }`,
})
export class ProtoMySheetPage {
  protected readonly selectedTab = signal<'games' | 'availabilities' | 'scenarios' | undefined>('scenarios');
  readonly only = input<'availabilities' | 'scenarios' | undefined>(undefined);
  protected readonly state = inject(PrototypeState);
  protected readonly store = inject(ConventionStore);
  protected readonly formatSeats = formatSeats;
  protected readonly formatScenarioDuration = formatScenarioDuration;
  private readonly my = mySheet();
  protected readonly resource = this.my.resource;
  protected readonly sheet = this.my.sheet;

  private readonly all = currentValue(apiResource(scenarioEndpoints.list));
  protected readonly others = computed(() =>
    (this.all() ?? []).filter((scenario) => scenario.gameMaster.id !== this.state.me()?.id),
  );

  protected readonly title = computed(() => {
    if (this.only() === 'availabilities') return 'Mes disponibilités';
    if (this.only() === 'scenarios') return 'Mes scénarios';
    return this.sheet()?.nickname ?? 'Ma fiche';
  });

  protected slotLabel(id: string): string {
    const slot = this.store.timeSlots().find((timeSlot) => timeSlot.id === id);
    return slot ? timeSlotLabel(slot) : '';
  }
}

/**
 * PROTOTYPE JETABLE (#171) : tous les scénarios, en lecture, sans lien vers la fiche des autres
 * MJ (réservée aux Organisateurs). « Les miens » se repère et se filtre.
 */
@Component({
  selector: 'app-proto-catalogue',
  imports: [Loadable, PageHeader, RouterLink, ScenarioIllustration],
  template: `
    <app-page-header title="Scénarios de la convention" />
    <app-loadable [resource]="scenarios" failure="Impossible de charger les scénarios.">
      <div class="body">
        <div class="chips" role="group" aria-label="Filtrer">
          <button type="button" [class.on]="!mineOnly" (click)="mineOnly = false">Tous</button>
          <button type="button" [class.on]="mineOnly" (click)="mineOnly = true">Les miens</button>
        </div>
        <ul class="rows">
          @for (scenario of shown(); track scenario.id) {
            <li>
              <app-scenario-illustration [title]="scenario.title" [imageUrl]="scenario.imageUrl" />
              <a [routerLink]="['/scenarios', scenario.id]">{{ scenario.title }}</a>
              <span class="meta">{{ scenario.system }}</span>
              <span class="meta">{{ scenario.gameMaster.nickname }}</span>
              @if (isMine(scenario)) {
                <span class="mine">le mien</span>
              }
            </li>
          }
        </ul>
        <p class="note">
          Prototype&nbsp;: la page d'un scénario d'un autre MJ reste la vraie, modifiable. L'espace du MJ
          la montrerait en lecture seule.
        </p>
      </div>
    </app-loadable>
  `,
  styles: PAGE_STYLES,
})
export class ProtoCataloguePage {
  private readonly state = inject(PrototypeState);
  protected readonly scenarios = apiResource(scenarioEndpoints.list);
  private readonly all = currentValue(this.scenarios);
  protected mineOnly = false;

  protected shown(): ScenarioListItemDto[] {
    const all = this.all() ?? [];
    return this.mineOnly ? all.filter((scenario) => this.isMine(scenario)) : all;
  }

  protected isMine(scenario: ScenarioListItemDto): boolean {
    return scenario.gameMaster.id === this.state.me()?.id;
  }
}

/**
 * PROTOTYPE JETABLE (#171), variante C : l'accueil répond à « où en suis-je ? ». La convention
 * (date, code de présence), puis trois cartes : disponibilités, scénarios, parties.
 */
@Component({
  selector: 'app-proto-dashboard',
  imports: [Button, Icon, Loadable, PageHeader, RouterLink],
  template: `
    <app-page-header [title]="'Bonjour ' + (sheet()?.nickname ?? '')" />
    <app-loadable [resource]="resource" failure="Impossible de charger ta fiche.">
      @if (sheet(); as me) {
        <div class="body">
          @if (store.value(); as convention) {
            <p class="meta">
              {{ convention.name }} · {{ formatDate(convention.date) }} · code de présence
              <strong>{{ convention.presenceCode }}</strong>
            </p>
          }
          <div class="cards">
            <a class="card" routerLink="/prototype-espace-mj/disponibilites">
              <span class="meta">Mes disponibilités</span>
              <span class="big">{{ me.availabilities.length }} / {{ store.timeSlots().length }}</span>
              <span [class.todo]="!me.availabilities.length" [class.done]="me.availabilities.length">
                <app-icon [name]="me.availabilities.length ? 'circle-check' : 'triangle-alert'" />
                {{ me.availabilities.length ? 'créneaux déclarés' : 'Déclare tes disponibilités' }}
              </span>
            </a>
            <a class="card" routerLink="/prototype-espace-mj/mes-scenarios">
              <span class="meta">Mes scénarios</span>
              <span class="big">{{ me.scenarios.length }}</span>
              <span [class.todo]="!me.scenarios.length" [class.done]="me.scenarios.length">
                <app-icon [name]="me.scenarios.length ? 'circle-check' : 'triangle-alert'" />
                {{ me.scenarios.length ? 'proposés' : 'Propose ton premier scénario' }}
              </span>
            </a>
            <div class="card">
              <span class="meta">Mes parties</span>
              <span class="big">{{ me.games.length }}</span>
              @for (game of me.games; track game.gameId + game.timeSlotId) {
                <span>{{ slotLabel(game.timeSlotId) }} · {{ game.scenario.title }} · {{ game.table.name }}</span>
              } @empty {
                <span class="meta">Les Organisateurs n'ont rien programmé pour toi.</span>
              }
            </div>
          </div>
          <div>
            <a appButton="primary" [routerLink]="['/mj', me.id, 'nouveau-scenario']">Proposer un scénario</a>
          </div>
        </div>
      }
    </app-loadable>
  `,
  styles: PAGE_STYLES + `.card { color: var(--text); text-decoration: none; }`,
})
export class ProtoDashboardPage {
  protected readonly store = inject(ConventionStore);
  protected readonly formatDate = formatConventionDate;
  private readonly my = mySheet();
  protected readonly resource = this.my.resource;
  protected readonly sheet = this.my.sheet;

  protected slotLabel(id: string): string {
    const slot = this.store.timeSlots().find((timeSlot) => timeSlot.id === id);
    return slot ? timeSlotLabel(slot) : '';
  }
}

export type { GameMasterSheetDto };
