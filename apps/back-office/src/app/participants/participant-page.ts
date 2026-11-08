import { Component, computed, inject, input, signal } from '@angular/core';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { participantEndpoints } from '@chimeres/contract';
import { formatCount, formatTimeOfDay, fr, timeSlotLabel } from '@chimeres/design';
import { apiResource, currentValue } from '../api-resource';
import { ConventionStore } from '../convention/convention-store';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { TIME_SLOT_STATES, TimeSlotState } from '../time-slots/time-slot-state';
import { Icon } from '../ui/icon';
import { describeParticipantResult } from './participant-result';

type TabValue = 'program' | 'phones';

/**
 * Fiche d'un pseudo, de participant ou de MJ (ID-5, docs/design/patterns.md, Fiche d'un pseudo),
 * en lecture : « Participants › pseudo », « Participant » ou « MJ » dessous, puis deux onglets de
 * classeur. « Programme » : la frise des créneaux, un rond à la couleur et à l'icône de l'état de
 * chacun, et le résultat du pseudo, tirage provisoire compris. « Téléphones » : l'heure de liaison
 * de chacun.
 */
@Component({
  selector: 'app-participant-page',
  imports: [Icon, Loadable, PageHeader, Tab, TabContent, TabList, TabPanel, Tabs, TimeSlotState],
  template: `
    <app-page-header
      [title]="sheet()?.nickname ?? 'Fiche du pseudo'"
      [trail]="[{ label: 'Participants', link: '/participants' }]"
    >
      <p appPageSubtitle class="role">
        @if (sheet(); as sheet) {
          {{ sheet.gameMaster ? 'MJ' : 'Participant' }}
        }
      </p>
    </app-page-header>
    <app-loadable
      [resource]="resource"
      failure="Impossible de charger le pseudo."
      notFound="Ce pseudo n'existe pas, ou plus."
    >
      @if (sheet(); as sheet) {
        <div ngTabs class="binder">
          <div ngTabList aria-label="Vues du pseudo" [(selectedTab)]="selectedTab">
            <button ngTab id="tab-program" type="button" value="program">
              <app-icon name="calendar" />Programme
            </button>
            <button ngTab id="tab-phones" type="button" value="phones">
              <app-icon name="smartphone" />Téléphones
              <span class="count">{{ formatCount(sheet.linkedPhones.length) }}</span>
            </button>
          </div>
          <div ngTabPanel value="program" class="panel">
            <ng-template ngTabContent>
              @if (rows().length) {
                <ol class="timeline">
                  @for (row of rows(); track row.timeSlotId) {
                    <li
                      [attr.data-time-slot-state]="row.state"
                      [class.settled]="row.state === 'ended' || row.state === 'published'"
                    >
                      <span class="node" aria-hidden="true">
                        <app-icon [name]="states[row.state].icon" />
                      </span>
                      <span class="when">
                        <span class="label">{{ row.label }}</span>
                        <app-time-slot-state [state]="row.state" />
                      </span>
                      <span class="result">
                        <span class="main" [class]="row.lines.tone">{{ row.lines.main }}</span>
                        @if (row.lines.detail; as detail) {
                          <span class="detail">{{ detail }}</span>
                        }
                      </span>
                    </li>
                  }
                </ol>
              } @else {
                <p class="none">Aucun créneau pour l'instant.</p>
              }
            </ng-template>
          </div>
          <div ngTabPanel value="phones" class="panel">
            <ng-template ngTabContent>
              @if (sheet.linkedPhones.length) {
                <ul class="phones">
                  @for (phone of sheet.linkedPhones; track $index) {
                    <li>{{ formatLinkedAt(phone.linkedAt) }}</li>
                  }
                </ul>
              } @else {
                <p class="none">
                  Aucun téléphone relié&nbsp;: la personne lit ses résultats à l'accueil.
                </p>
              }
            </ng-template>
          </div>
        </div>
      }
    </app-loadable>
  `,
  styles: `
    @layer components {
      app-loadable {
        display: flex;
        flex-direction: column;
        padding: var(--space-l) var(--space-xl);
      }

      .binder {
        max-width: 48rem;
      }

      /* La ligne du rôle a sa place réservée : elle ne décale rien en apparaissant. */
      .role {
        min-height: calc(var(--font-size-meta) * var(--line-height-text));
        margin: var(--space-xs) 0 0;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .none {
        margin: 0;
        color: var(--text-muted);
      }

      /*
       * La frise : un rond par créneau, relié au suivant. Trait plein pour ce qui est figé (tirage
       * publié, terminé), en pointillés pour ce qui peut encore changer.
       */
      .timeline {
        margin: 0;
        padding: 0;
        list-style: none;

        li {
          position: relative;
          display: flex;
          gap: var(--space-m);
          align-items: center;
          padding-block: var(--space-s);

          &::before {
            content: '';
            position: absolute;
            top: 0;
            bottom: 0;
            left: calc(0.875rem - 1px);
            border-left: 2px dashed var(--engraving-strong);
          }

          &.settled::before {
            border-left-style: solid;
          }

          &:first-child::before {
            top: 50%;
          }

          &:last-child::before {
            bottom: 50%;
          }

          &:only-child::before {
            display: none;
          }
        }
      }

      .node {
        position: relative;
        z-index: 1;
        display: grid;
        flex: none;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        border: 2px solid var(--time-slot-state);
        border-radius: 50%;
        background: color-mix(in srgb, var(--time-slot-state) 20%, var(--surface-2));
        color: var(--time-slot-state);

        app-icon {
          width: 0.875rem;
          height: 0.875rem;
        }
      }

      .when {
        display: flex;
        flex: none;
        flex-direction: column;
        width: 14rem;
        font-size: var(--font-size-meta);

        .label {
          color: var(--text);
          font-weight: 600;
        }
      }

      .result {
        display: flex;
        flex-direction: column;
      }

      .main {
        font-weight: 600;

        &.danger {
          color: var(--danger);
        }

        &.muted {
          color: var(--text-muted);
          font-weight: 400;
        }
      }

      .detail {
        color: var(--text-muted);
      }

      .phones {
        margin: 0;
        padding: 0;
        list-style: none;

        li {
          padding-block: var(--space-s);
          border-bottom: 1px solid var(--border);
        }
      }
    }
  `,
})
export class ParticipantPage {
  /** Identifiant du pseudo, lu dans l'URL. */
  readonly id = input.required<string>();

  protected readonly resource = apiResource(participantEndpoints.read, () => ({
    participantId: this.id(),
  }));
  protected readonly sheet = currentValue(this.resource);
  protected readonly selectedTab = signal<TabValue | undefined>('program');
  protected readonly states = TIME_SLOT_STATES;
  protected readonly formatCount = formatCount;

  private readonly store = inject(ConventionStore);

  /** Un créneau par ligne : son libellé, avec ses heures si la convention est lue, et son résultat. */
  protected readonly rows = computed(() => {
    const slots = new Map(this.store.timeSlots().map((slot) => [slot.id, slot]));
    return (this.sheet()?.timeSlots ?? []).map((row) => {
      const slot = slots.get(row.timeSlotId);
      return {
        ...row,
        label: slot ? timeSlotLabel(slot) : fr`Créneau ${row.rank}`,
        lines: describeParticipantResult(row.result),
      };
    });
  });

  /** « Relié à 9 h 12 ». */
  protected formatLinkedAt(linkedAt: string): string {
    return fr`Relié à ${formatTimeOfDay(new Date(linkedAt))}`;
  }
}
