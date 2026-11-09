import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  participantEndpoints,
  type ParticipantSheetDto,
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
import { Pip } from '../ui/pip';
import { TableFilter } from '../ui/table-filter';
import { NewParticipant } from './new-participant';

/** Le délai entre la dernière frappe et la recherche : une requête par mot, pas par lettre. */
const SEARCH_DELAY_MS = 250;

/**
 * La liste « Participants » (ID-5, docs/design/patterns.md, Participants) : la recherche, que l'API
 * fait, par une partie du pseudo (ID-7) ou du titre d'une partie où il est inscrit, puis un pseudo
 * par ligne, qui mène à sa fiche, « MJ » en gris pour un MJ, ses inscriptions par créneau en ronds, et son nombre de
 * téléphones reliés. La liste se tient à jour seule (`liveResource()`), et garde ses lignes pendant
 * une recherche. « Créer un pseudo », sous la liste, ouvre une ligne « Nouveau pseudo » en dernier
 * (ID-12) ; le pseudo créé, sa fiche s'ouvre.
 */
@Component({
  selector: 'app-participants-page',
  imports: [Button, EmptyState, Loadable, NewParticipant, PageHeader, Pip, RouterLink, TableFilter],
  template: `
    <app-page-header title="Participants">
      <p appPageSubtitle class="freshness">
        @if (list.ageLine(); as line) {
          <button type="button" (click)="list.reload()">{{ line }}</button>
        }
      </p>
    </app-page-header>
    <app-loadable [resource]="list.firstRead" failure="Impossible de charger les participants.">
      @if (list.value(); as participants) {
        @if (!participants.length && !search() && !adding()) {
          <app-empty-state>
            <p>Aucun pseudo pour l'instant.</p>
            <button type="button" appButton="primary" (click)="adding.set(true)">
              Créer le premier pseudo
            </button>
          </app-empty-state>
        } @else {
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
                    @if (row.participant.gameMaster) {
                      <span class="role">MJ</span>
                    }
                    @if (row.participant.matchedGameTitle; as title) {
                      <span class="match">inscrit à «&nbsp;{{ title }}&nbsp;»</span>
                    }
                  </th>
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
                @if (search()) {
                  <tr>
                    <td class="none" colspan="3">
                      Aucun pseudo ne correspond
                      <button type="button" appButton="quiet" (click)="clearSearch()">
                        Effacer la recherche
                      </button>
                    </td>
                  </tr>
                }
              }
              @if (adding()) {
                <tr class="new">
                  <td colspan="3">
                    <app-new-participant (added)="onAdded($event)" (cancelled)="closeNew()" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (!adding()) {
            <button type="button" appButton="secondary" class="add" (click)="adding.set(true)">
              Créer un pseudo
            </button>
          }
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
        padding: var(--space-l) var(--space-xl);
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
        width: 44rem;
      }

      .number {
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      tbody tr:not(.new):hover {
        background: var(--surface-1);
      }

      /* La bulle d'erreur de la ligne « Nouveau pseudo » se place sous la cellule. */
      .new td {
        position: relative;
      }

      .nickname {
        font-weight: 600;
      }

      .role {
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

  /** La ligne « Nouveau pseudo » est ouverte. */
  protected readonly adding = signal(false);

  private readonly filter = viewChild(TableFilter);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** Chaque pseudo, avec un rond par créneau et leur texte pour le lecteur d'écran. */
  protected readonly rows = computed(() =>
    (this.list.value() ?? []).map((participant) => {
      const pips = participant.signUpCounts.map((slot) => ({
        ...slot,
        title: formatPipTitle(slot),
      }));
      return { participant, pips, summary: pips.map(({ title }) => `${title}.`).join(' ') };
    }),
  );

  protected delaySearch(text: string): void {
    this.typed.set(text);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search.set(text), SEARCH_DELAY_MS);
  }

  /** Le pseudo est créé : sa fiche s'ouvre. */
  protected onAdded({ id }: ParticipantSheetDto): void {
    void this.router.navigate(['/participants', id]);
  }

  /** Ferme la ligne ; le focus revient à « Créer un pseudo », ou à l'invitation de l'état vide. */
  protected closeNew(): void {
    this.adding.set(false);
    afterNextRender(
      () => this.host.querySelector<HTMLElement>('.add, app-empty-state button')?.focus(),
      {
        injector: this.injector,
      },
    );
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
