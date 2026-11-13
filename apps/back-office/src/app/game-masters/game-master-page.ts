import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { Router, RouterLink } from '@angular/router';
import {
  gameMasterEndpoints,
  scenarioEndpoints,
  type Endpoint,
  type GameMasterParams,
  type GameMasterSheetDto,
} from '@chimeres/contract';
import { AccountStore } from '../account/account-store';
import { injectApiCall } from '../api-call';
import { apiResource, currentValue } from '../api-resource';
import { ConventionStore } from '../convention/convention-store';
import { NicknameEditor } from '../forms/nickname-editor';
import { availabilitiesConsequences } from './availabilities-consequences';
import { AvailabilityTimeline } from './availability-timeline';
import { formatScenarioDuration } from '../scenarios/scenario-format';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { formatSeats, fr, timeSlotLabel } from '@chimeres/design';
import { Button } from '../ui/button';
import { Confirmation } from '../ui/confirmation';
import { Icon } from '../ui/icon';
import { MoreMenu, type MoreMenuItem } from '../ui/more-menu';
import { ScenarioIllustration } from '../ui/scenario-illustration';

const MENU: readonly MoreMenuItem[] = [{ value: 'remove', label: 'Supprimer le MJ', danger: true }];

/** Les onglets de la fiche. */
type TabValue = 'scenarios' | 'availabilities' | 'games';

/**
 * Fiche d'un MJ (docs/design/patterns.md, Coquille), en trois onglets de classeur : ses scénarios
 * (par défaut, avec « Proposer un scénario »), ses disponibilités, sur la frise de la journée, et
 * ses parties. Un Organisateur y arrive par « MJ › pseudo », y modifie le pseudo dans l'en-tête et
 * supprime le MJ par « ⋯ ». « Ma fiche » (`mine`) est celle du MJ connecté, sans ces gestes ni fil
 * d'Ariane : son espace. Chaque geste ne s'affiche que si le descripteur de son endpoint l'ouvre au
 * compte connecté (ADR 0017).
 */
@Component({
  selector: 'app-game-master-page',
  imports: [
    AvailabilityTimeline,
    Button,
    Icon,
    Loadable,
    MoreMenu,
    NicknameEditor,
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
    <app-page-header
      [title]="gameMaster()?.nickname ?? (mine() ? 'Ma fiche' : 'Fiche du MJ')"
      [trail]="trail()"
      [titleHidden]="editing()"
    >
      <ng-container ngProjectAs="[appPageTitle]">
        @if (gameMaster(); as gameMaster) {
          @if (editing()) {
            <app-nickname-editor
              owner="game-master"
              [nickname]="gameMaster.nickname"
              [rename]="rename"
              (saved)="closeEditor()"
              (cancelled)="closeEditor()"
            />
          } @else if (canRename()) {
            <button
              type="button"
              appButton="icon"
              class="edit-nickname"
              aria-label="Modifier le pseudo"
              title="Modifier le pseudo"
              (click)="editing.set(true)"
            >
              <app-icon name="pencil" />
            </button>
          }
        }
      </ng-container>
      @if (gameMaster(); as gameMaster) {
        @if (canRemove()) {
          <app-more-menu
            label="Autres actions sur le MJ"
            [items]="menu"
            (selected)="onMenu($event, gameMaster)"
          />
        }
      }
    </app-page-header>
    @if (gameMasterId()) {
      <app-loadable
        [resource]="resource"
        failure="Impossible de charger le MJ."
        notFound="Ce MJ n'existe pas, ou plus."
      >
        @if (gameMaster(); as gameMaster) {
          <div ngTabs class="binder">
            <div ngTabList [attr.aria-label]="labels().tabs" [(selectedTab)]="selectedTab">
              <button ngTab id="tab-scenarios" type="button" value="scenarios">
                <app-icon name="book-open" />{{ labels().scenarios }}
              </button>
              <button ngTab id="tab-availabilities" type="button" value="availabilities">
                <app-icon name="clock" />{{ labels().availabilities }}
                <span class="count" [attr.aria-label]="availabilityCount(gameMaster)"
                  >{{ gameMaster.availabilities.length }} / {{ timeSlots().length }}</span
                >
              </button>
              <button ngTab id="tab-games" type="button" value="games">
                <app-icon name="dices" />{{ labels().games }}
              </button>
            </div>
            <div ngTabPanel value="scenarios" class="panel">
              <ng-template ngTabContent>
                @if (canPropose()) {
                  <div class="panel-actions">
                    <a
                      appButton="primary"
                      [routerLink]="['/mj', gameMaster.id, 'nouveau-scenario']"
                    >
                      Proposer un scénario
                    </a>
                  </div>
                }
                @if (gameMaster.scenarios.length) {
                  <ul class="rows scenarios">
                    @for (scenario of gameMaster.scenarios; track scenario.id) {
                      <li>
                        <app-scenario-illustration
                          [title]="scenario.title"
                          [imageUrl]="scenario.imageUrl"
                        />
                        <a [routerLink]="['/scenarios', scenario.id]">{{ scenario.title }}</a>
                        <span class="meta">{{ scenario.system }}</span>
                        <span class="meta">{{ formatSeats(scenario.seats) }}</span>
                        <span class="meta">{{ formatScenarioDuration(scenario.duration) }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="none">Aucun scénario pour l'instant.</p>
                }
              </ng-template>
            </div>
            <div ngTabPanel value="availabilities" class="panel">
              <ng-template ngTabContent>
                @if (timeSlots().length) {
                  <app-availability-timeline
                    [gameMaster]="gameMaster"
                    [timeSlots]="timeSlots()"
                    (changed)="onAvailabilitiesChanged($event)"
                    (refused)="reloadAfterRefusal()"
                  />
                } @else {
                  <p class="none">
                    Aucun créneau pour l'instant&nbsp;: les disponibilités se saisissent une fois
                    les créneaux de la journée définis.
                  </p>
                }
              </ng-template>
            </div>
            <div ngTabPanel value="games" class="panel">
              <ng-template ngTabContent>
                @if (gameMaster.games.length) {
                  <ul class="rows games">
                    @for (game of gameMaster.games; track game.gameId + game.timeSlotId) {
                      <li>
                        <span class="meta">{{ timeSlotName(game.timeSlotId) }}</span>
                        <a [routerLink]="['/scenarios', game.scenario.id]">{{
                          game.scenario.title
                        }}</a>
                        <span class="meta">{{ game.table.name }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="none">Aucune partie programmée pour l'instant.</p>
                }
              </ng-template>
            </div>
          </div>
        }
      </app-loadable>
    } @else if (account()) {
      <p class="body none">Ton compte n'est pas celui d'un MJ&nbsp;: tu n'as pas de fiche.</p>
    }
  `,
  styles: `
    @layer components {
      app-loadable {
        display: flex;
        flex-direction: column;
        gap: var(--space-xl);
        padding: var(--space-l) var(--space-xl);
      }

      .body {
        padding: var(--space-l) var(--space-xl);
      }

      .none {
        color: var(--text-muted);
      }

      .panel-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: var(--space-m);
      }

      .rows {
        display: grid;
        column-gap: var(--space-l);
        margin: 0;
        padding: 0;
        list-style: none;

        li {
          display: grid;
          grid-column: 1 / -1;
          grid-template-columns: subgrid;
          align-items: center;
          height: 48px;
          border-bottom: 1px solid var(--border);
        }

        a {
          font-weight: 600;
        }
      }

      .scenarios {
        grid-template-columns: 32px minmax(12rem, max-content) repeat(3, max-content);
      }

      .games {
        grid-template-columns: max-content minmax(12rem, max-content) max-content;
      }

      app-scenario-illustration {
        width: 32px;
      }

      .meta {
        color: var(--text-muted);
      }
    }
  `,
})
export class GameMasterPage {
  /** Identifiant du MJ, lu dans l'URL ; aucun sur « Ma fiche ». */
  readonly id = input<string>();
  /** « Ma fiche » : la fiche du MJ connecté (donnée de la route). */
  readonly mine = input(false);

  private readonly accountStore = inject(AccountStore);
  protected readonly account = this.accountStore.value;
  /** Le MJ affiché : celui de l'URL, ou celui du compte connecté sur « Ma fiche ». */
  protected readonly gameMasterId = computed(() =>
    this.mine() ? (this.account()?.gameMasterId ?? undefined) : this.id(),
  );

  protected readonly resource = apiResource(gameMasterEndpoints.read, () => {
    const gameMasterId = this.gameMasterId();
    return gameMasterId ? { gameMasterId } : undefined;
  });
  protected readonly gameMaster = currentValue(this.resource);
  protected readonly selectedTab = signal<TabValue | undefined>('scenarios');
  protected readonly editing = signal(false);

  /** Les gestes d'Organisateur, jamais sur « Ma fiche ». */
  protected readonly canRename = computed(
    () => !this.mine() && this.can(gameMasterEndpoints.rename),
  );
  protected readonly canRemove = computed(
    () => !this.mine() && this.can(gameMasterEndpoints.remove),
  );
  protected readonly canPropose = computed(() => this.can(scenarioEndpoints.propose));
  protected readonly trail = computed(() =>
    !this.mine() && this.accountStore.can(gameMasterEndpoints.list)
      ? [{ label: 'MJ', link: '/mj' }]
      : [],
  );
  protected readonly labels = computed(() =>
    this.mine()
      ? {
          tabs: 'Vues de ma fiche',
          scenarios: 'Mes scénarios',
          availabilities: 'Mes disponibilités',
          games: 'Mes parties',
        }
      : {
          tabs: 'Vues du MJ',
          scenarios: 'Scénarios',
          availabilities: 'Disponibilités',
          games: 'Parties',
        },
  );
  protected readonly menu = MENU;
  protected readonly formatSeats = formatSeats;
  protected readonly formatScenarioDuration = formatScenarioDuration;

  private readonly store = inject(ConventionStore);
  protected readonly timeSlots = this.store.timeSlots;

  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly confirmation = inject(Confirmation);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  /** Le compte connecté peut-il appeler cet endpoint, pour le MJ affiché ? */
  private can(endpoint: Endpoint<unknown, GameMasterParams, unknown, unknown>): boolean {
    const gameMasterId = this.gameMasterId();
    return gameMasterId !== undefined && this.accountStore.can(endpoint, { gameMasterId });
  }

  /** « Créneau 2 · 14 h 00 – 16 h 00 », ou rien si le créneau n'est plus dans la convention lue. */
  protected timeSlotName(timeSlotId: string): string {
    const timeSlot = this.timeSlots().find(({ id }) => id === timeSlotId);
    return timeSlot ? timeSlotLabel(timeSlot) : '';
  }

  /** Le nom accessible du compteur : « 2 créneaux déclarés sur 5 ». */
  protected availabilityCount({ availabilities }: GameMasterSheetDto): string {
    return fr`${availabilities.length} déclarés sur ${this.timeSlots().length} créneaux`;
  }

  /** Renomme le MJ, par la règle de tout pseudo (ID-13), et garde la fiche relue. */
  protected readonly rename = async (nickname: string): Promise<void> => {
    this.resource.set(
      await this.apiCall(gameMasterEndpoints.rename, {
        params: { gameMasterId: this.gameMasterId()! },
        body: { nickname },
      }),
    );
  };

  /** Ferme le champ du pseudo ; le focus revient au crayon. */
  protected closeEditor(): void {
    this.editing.set(false);
    afterNextRender(() => this.host.querySelector<HTMLElement>('.edit-nickname')?.focus(), {
      injector: this.injector,
    });
  }

  /** Le nombre de disponibilités de chaque créneau a changé : la convention partagée est relue. */
  protected onAvailabilitiesChanged(gameMaster: GameMasterSheetDto): void {
    this.resource.set(gameMaster);
    this.store.convention.reload();
  }

  /** Un geste refusé : le MJ ou un créneau a pu changer ailleurs, l'écran est relu. */
  protected reloadAfterRefusal(): void {
    this.resource.reload();
    this.store.convention.reload();
  }

  protected onMenu(value: string, gameMaster: GameMasterSheetDto): void {
    if (value === 'remove') void this.remove(gameMaster);
  }

  private async remove({ id, nickname, availabilities }: GameMasterSheetDto) {
    const removed = await this.confirmation.ask({
      question: fr`Supprimer le MJ « ${nickname} » ?`,
      consequences: availabilitiesConsequences(availabilities.length),
      confirmLabel: 'Supprimer le MJ',
      action: () => this.apiCall(gameMasterEndpoints.remove, { params: { gameMasterId: id } }),
      onStale: () => this.reloadAfterRefusal(),
    });
    if (!removed) return;
    this.announcer.announce(fr`MJ « ${nickname} » supprimé.`);
    if (availabilities.length) this.store.convention.reload();
    await this.router.navigate(['/mj']);
  }
}
