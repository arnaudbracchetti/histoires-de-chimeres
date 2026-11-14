import { Component, computed, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  participantEndpoints,
  type AccessStateDto,
  type ParticipantListEntryDto,
  type TimeSlotSignUpCountDto,
} from '@chimeres/contract';
import { countOf, fr } from '@chimeres/design';
import { apiQueryResource } from '../api-resource';
import { liveResource } from '../live-resource';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { TIME_SLOT_STATES } from '../time-slots/time-slot-state';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Icon } from '../ui/icon';
import { Pip } from '../ui/pip';
import { TableFilter } from '../ui/table-filter';
import { ACCESS_STATE_FILTERS, describeAccessState } from './access-state';
import { ParticipantCreation } from './participant-creation';
import { RoleBadges } from './role-badges';

/** Le délai entre la dernière frappe et la recherche : une requête par mot, pas par lettre. */
const SEARCH_DELAY_MS = 250;

/**
 * La liste « Participants » (ID-5, docs/design/patterns.md, Participants) : la recherche, que l'API
 * fait, par une partie du pseudo (ID-7) ou du titre d'une partie où il est inscrit, puis un pseudo
 * par ligne, qui mène à sa fiche, ses rôles en badges, l'état de son accès au back office, ses
 * inscriptions par créneau en ronds, et son nombre de téléphones reliés (ID-16). En tête, la bascule
 * « Tous les participants avec un compte » ↔ « Tous les participants », puis un filtre par état du
 * compte, chacun avec son nombre, sur les lignes de la recherche. La liste se tient à jour seule
 * (`liveResource()`), et garde ses lignes pendant une recherche. « Créer un pseudo », action
 * principale de l'en-tête, ouvre l'assistant (ID-12, ID-16).
 */
@Component({
  selector: 'app-participants-page',
  imports: [
    Button,
    EmptyState,
    Icon,
    Loadable,
    PageHeader,
    Pip,
    RoleBadges,
    RouterLink,
    TableFilter,
  ],
  template: `
    <app-page-header title="Participants">
      <p appPageSubtitle class="freshness">
        @if (list.ageLine(); as line) {
          <button type="button" (click)="list.reload()">{{ line }}</button>
        }
      </p>
      <button type="button" appButton="primary" (click)="create()">Créer un pseudo</button>
    </app-page-header>
    <app-loadable class="page-body" [resource]="list.firstRead" failure="Impossible de charger les participants.">
      @if (list.value(); as participants) {
        @if (!participants.length && !search()) {
          <app-empty-state>
            <p>Aucun pseudo pour l'instant.</p>
            <button type="button" appButton="primary" (click)="create()">
              Créer le premier pseudo
            </button>
          </app-empty-state>
        } @else {
          <div class="filters" role="group" aria-label="Filtrer par accès au back office">
            <button type="button" class="filter scope" (click)="toggleAccountsOnly()">
              @if (accountsOnly()) {
                Tous les participants <span class="count">{{ participants.length }}</span>
              } @else {
                Tous les participants avec un compte
                <span class="count">{{ accountCount() }}</span>
              }
            </button>
            <span class="separator" aria-hidden="true"></span>
            @for (filter of stateFilters; track filter.state) {
              <button
                type="button"
                class="filter"
                [attr.data-access-state]="filter.state"
                [attr.aria-pressed]="stateFilter() === filter.state"
                (click)="toggleStateFilter(filter.state)"
              >
                {{ filter.label }} <span class="count">{{ stateCounts()[filter.state] }}</span>
              </button>
            }
          </div>
          <p class="help">
            Tape quelques lettres du pseudo, ou du titre d'une partie où il est inscrit.
          </p>
          <app-table-filter
            label="Pseudo ou titre d'une partie"
            [value]="typed()"
            (valueChange)="delaySearch($event)"
          />
          <table>
            <caption class="visually-hidden">
              Pseudos de la convention
            </caption>
            <thead>
              <tr>
                <th scope="col">Pseudo</th>
                <th scope="col">Rôle</th>
                <th scope="col">Accès au back office</th>
                <th scope="col">Inscriptions par créneau</th>
                <th scope="col" class="number">Téléphones</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.participant.id) {
                <tr>
                  <th scope="row">
                    <a class="nickname" [routerLink]="['/participants', row.participant.id]">{{
                      row.participant.nickname
                    }}</a>
                    @if (row.participant.matchedGameTitle; as title) {
                      <span class="match">inscrit à «&nbsp;{{ title }}&nbsp;»</span>
                    }
                  </th>
                  <td><app-role-badges [roles]="row.participant" /></td>
                  <td>
                    @if (row.access; as access) {
                      <span class="access" [attr.data-access-state]="access.state">
                        <app-icon [name]="access.icon" />{{ access.label }}
                      </span>
                    }
                  </td>
                  <td>
                    <span class="visually-hidden">{{ row.summary }}</span>
                    <span class="pips" aria-hidden="true">
                      @for (pip of row.pips; track pip.timeSlotId) {
                        <app-pip
                          [attr.data-time-slot-state]="pip.state"
                          [fill]="pip.count > 0 ? 'tint' : null"
                          [dimmed]="pip.state === 'ended'"
                          [title]="pip.title"
                          >{{ pip.count }}</app-pip
                        >
                      }
                    </span>
                  </td>
                  <td class="number">{{ row.participant.linkedPhoneCount }}</td>
                </tr>
              } @empty {
                @if (filtered()) {
                  <tr>
                    <td class="none" colspan="5">
                      Aucun pseudo ne correspond
                      <button type="button" appButton="quiet" (click)="clearFilters()">
                        Effacer le filtre
                      </button>
                    </td>
                  </tr>
                } @else if (search()) {
                  <tr>
                    <td class="none" colspan="5">
                      Aucun pseudo ne correspond
                      <button type="button" appButton="quiet" (click)="clearSearch()">
                        Effacer la recherche
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        }
      }
    </app-loadable>
  `,
  styles: `
    @layer components {
      app-loadable {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        align-items: flex-start;
      }

      /* La ligne d'âge a sa place réservée : elle ne décale rien en apparaissant. */
      .freshness {
        min-height: calc(var(--font-size-meta) * var(--line-height-text));
        margin: var(--space-xs) 0 0;
        color: var(--text-muted);
        font-size: var(--font-size-meta);

        button {
          padding: 0;
          border: none;
          background: none;
          color: inherit;
          font: inherit;
          text-decoration: underline;
          cursor: pointer;
        }
      }

      .help {
        margin: 0;
        color: var(--text-muted);
      }

      table {
        width: 100%;
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }

      /* Un filtre d'état porte la couleur de statut de son état, à gauche ; la bascule, en gris. */
      .filter {
        padding: 0 var(--space-s);
        border: 1px solid
          color-mix(in srgb, var(--access-state, var(--text-muted)) 50%, transparent);
        border-left: 4px solid var(--access-state, var(--text-muted));
        border-radius: var(--radius-control);
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: var(--font-size-meta);
        cursor: pointer;

        &[aria-pressed='true'] {
          background: color-mix(in srgb, var(--access-state) 20%, transparent);
          font-weight: 600;
        }
      }

      .scope {
        border-left-width: 1px;
      }

      .count {
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }

      .separator {
        width: 1px;
        margin-inline: var(--space-xs);
        background: var(--border);
      }

      .access {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        color: var(--access-state);
        font-size: var(--font-size-meta);
        font-weight: 600;
      }

      .number {
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      tbody tr:hover {
        background: var(--surface-1);
      }

      .nickname {
        font-weight: 600;
      }

      .match {
        display: block;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
        font-weight: 400;
      }

      .pips {
        display: flex;
        gap: var(--space-xs);
      }

      /* Le contour de chaque rond prend la couleur de l'état de son créneau (styles.css). */
      app-pip {
        --pip-color: var(--time-slot-state);
      }

      .none {
        color: var(--text-muted);
      }
    }
  `,
})
export class ParticipantsPage {
  /** Le texte du champ, tel que tapé. */
  protected readonly typed = signal('');
  /** La recherche envoyée à l'API, après le délai : l'API ignore une recherche vide. */
  protected readonly search = signal('');
  protected readonly list = liveResource(
    apiQueryResource(participantEndpoints.list, () => ({ search: this.search() })),
  );

  /** La bascule : seulement les pseudos qui ont un compte, ou tous. */
  protected readonly accountsOnly = signal(false);
  /** L'état de compte choisi, ou `null` sans filtre d'état. */
  protected readonly stateFilter = signal<AccessStateDto | null>(null);
  protected readonly stateFilters = ACCESS_STATE_FILTERS;
  /** Un filtre de la bascule ou d'état cache des lignes. */
  protected readonly filtered = computed(() => this.accountsOnly() || this.stateFilter() !== null);

  /** Le nombre de pseudos de la recherche qui ont un compte. */
  protected readonly accountCount = computed(
    () => (this.list.value() ?? []).filter(({ account }) => account).length,
  );
  /** Le nombre de pseudos de la recherche dans chaque état. */
  protected readonly stateCounts = computed(() => {
    const states = (this.list.value() ?? []).map(({ account }) => account?.state);
    return Object.fromEntries(
      ACCESS_STATE_FILTERS.map(({ state }) => [
        state,
        states.filter((one) => one === state).length,
      ]),
    ) as Record<AccessStateDto, number>;
  });

  private readonly filter = viewChild(TableFilter);
  private readonly creation = inject(ParticipantCreation);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /**
   * Chaque pseudo que les filtres gardent, avec l'état de son compte, un rond par créneau et leur
   * texte pour le lecteur d'écran.
   */
  protected readonly rows = computed(() =>
    (this.list.value() ?? [])
      .filter((participant) => this.isKept(participant))
      .map((participant) => {
        const pips = participant.signUpCounts.map((slot) => ({
          ...slot,
          title: formatPipTitle(slot),
        }));
        return {
          participant,
          access: participant.account && describeAccessState(participant.account),
          pips,
          summary: pips.map(({ title }) => `${title}.`).join(' '),
        };
      }),
  );

  /** Passe de tous les pseudos à ceux qui ont un compte, et retour ; le filtre d'état s'efface. */
  protected toggleAccountsOnly(): void {
    this.accountsOnly.update((only) => !only);
    this.stateFilter.set(null);
  }

  /** Choisit un état, ou l'efface s'il était choisi. */
  protected toggleStateFilter(state: AccessStateDto): void {
    this.stateFilter.update((chosen) => (chosen === state ? null : state));
  }

  protected clearFilters(): void {
    this.accountsOnly.set(false);
    this.stateFilter.set(null);
  }

  /** Le pseudo passe la bascule et le filtre d'état. */
  private isKept({ account }: ParticipantListEntryDto): boolean {
    if (this.accountsOnly() && !account) return false;
    const state = this.stateFilter();
    return state === null || account?.state === state;
  }

  protected delaySearch(text: string): void {
    this.typed.set(text);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search.set(text), SEARCH_DELAY_MS);
  }

  /**
   * L'assistant « Créer un pseudo ». Sans rôle, la fiche du pseudo s'ouvre ; avec un rôle, la liste
   * relue le montre, avec l'état de son compte, même si l'assistant se ferme par Échap.
   */
  protected async create(): Promise<void> {
    await this.creation.open();
    this.list.reload();
  }

  /** Toutes les lignes reviennent, et le focus retourne au champ. */
  protected clearSearch(): void {
    clearTimeout(this.timer);
    this.typed.set('');
    this.search.set('');
    this.filter()?.focus();
  }
}

/** « Créneau 2 · tirage publié : 1 inscription ». */
function formatPipTitle({ rank, state, count }: TimeSlotSignUpCountDto): string {
  const label = TIME_SLOT_STATES[state].label.toLowerCase();
  return fr`Créneau ${rank} · ${label} : ${countOf(count, 'inscription', 'inscriptions')}`;
}
