import { Component, computed, inject, input, model, output } from '@angular/core';
import {
  participantEndpoints,
  signUpTrackingEndpoints,
  type ParticipantSheetDto,
  type TrackedGameDto,
} from '@chimeres/contract';
import { fr, timeSlotLabel } from '@chimeres/design';
import { injectApiCall } from '../api-call';
import { apiResource, currentValue } from '../api-resource';
import { ConventionStore } from '../convention/convention-store';
import { injectGesture } from '../gesture';
import { Announcer } from '../shell/announcer';
import { Button } from '../ui/button';
import { GameSignUpFigures } from '../ui/game-sign-up-figures';

/** La clé de l'écriture qui retire du tirage d'un créneau, à côté de celles des parties. */
const WITHDRAW_FROM_DRAW = 'withdraw-from-draw:';

/**
 * L'onglet « Inscriptions » de la fiche d'un pseudo (docs/design/patterns.md, Fiche d'un pseudo) :
 * l'Organisateur inscrit le pseudo à sa place (ID-12), aux règles du téléphone. Une pilule par
 * créneau ouvert, puis une case par partie qui y commence, enregistrée dès qu'on la coche, sans
 * confirmation, avec la jauge et les chiffres du pilotage. La partie qu'il mène est grisée ; sur un
 * créneau où il mène, ses inscriptions sont de secours (IN-4). Sans partie sur le créneau, il peut
 * être retiré du tirage (IN-6). Pendant l'écriture, la case prend son nouvel état, atténuée ;
 * refusée, elle revient, et le refus part en alerte.
 */
@Component({
  selector: 'app-participant-sign-ups',
  imports: [Button, GameSignUpFigures],
  template: `
    @if (openSlots().length) {
      <div class="pills" role="radiogroup" aria-label="Créneau">
        @for (slot of openSlots(); track slot.timeSlotId) {
          <label class="pill" [class.selected]="slot.timeSlotId === current()?.timeSlotId">
            <input
              type="radio"
              name="sign-ups-time-slot"
              class="visually-hidden"
              [value]="slot.timeSlotId"
              [checked]="slot.timeSlotId === current()?.timeSlotId"
              (change)="timeSlotId.set(slot.timeSlotId)"
            />
            {{ slot.label }}
          </label>
        }
      </div>
      @if (current(); as slot) {
        @if (ledTitle(); as title) {
          <p class="backup">
            Mène «&nbsp;{{ title }}&nbsp;»&nbsp;: ses inscriptions sur ce créneau sont de secours.
          </p>
        }
        @if (lines().length) {
          <ul class="games">
            @for (line of lines(); track line.game.id) {
              <li [class.own]="line.own" [class.pending]="writes.isRunning(line.game.id)">
                <label class="check">
                  <input
                    type="checkbox"
                    [checked]="isChecked(line.game.id)"
                    [disabled]="line.own"
                    (change)="onChange(line.game, $any($event.target))"
                  />
                  <span class="title">{{ line.game.scenario.title }}</span>
                  @if (line.own) {
                    <span class="quiet">sa partie</span>
                  }
                </label>
                <app-game-sign-up-figures class="figures" [game]="line.game" excess="label" />
              </li>
            }
          </ul>
        } @else if (tracking()) {
          <p class="quiet">Aucune partie ne commence sur ce créneau.</p>
        }
        @if (slot.withoutGame) {
          <p class="without-game">
            Sans partie sur ce créneau.
            <button
              type="button"
              appButton="secondary"
              [disabled]="writes.isRunning(withdrawKey(slot.timeSlotId))"
              (click)="withdrawFromDraw(slot.timeSlotId, slot.rank)"
            >
              Retirer du tirage
            </button>
          </p>
        }
      }
    } @else {
      <p class="quiet">Aucun créneau n'a ses inscriptions ouvertes.</p>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      p {
        margin: 0;
      }

      .quiet {
        color: var(--text-muted);
      }

      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);
      }

      .pill {
        padding: var(--space-xs) var(--space-m);
        border: 1px solid var(--border);
        border-radius: 999px;
        color: var(--text-muted);
        cursor: pointer;

        &:hover {
          color: var(--text);
        }

        &.selected {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 14%, transparent);
          color: var(--text);
          font-weight: 600;
        }

        &:has(:focus-visible) {
          outline: 2px solid var(--focus);
          outline-offset: 2px;
        }
      }

      .backup {
        color: var(--text-muted);
      }

      .games {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;

        li {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 17rem;
          gap: var(--space-m);
          align-items: center;
          padding-block: var(--space-s);
          border-bottom: 1px solid var(--border);

          &.pending {
            opacity: 0.45;
          }

          &.own .title {
            color: var(--text-muted);
          }
        }
      }

      .check {
        display: flex;
        gap: var(--space-s);
        align-items: center;
        min-height: 44px;
        cursor: pointer;

        input {
          flex: none;
          width: 1.125rem;
          height: 1.125rem;
          accent-color: var(--accent);
        }

        .title {
          font-weight: 600;
        }
      }

      li.own .check {
        cursor: default;
      }

      .figures {
        align-self: stretch;
        justify-content: center;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .without-game {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s) var(--space-m);
        align-items: center;
        color: var(--danger);
        font-weight: 600;
      }
    }
  `,
})
export class ParticipantSignUps {
  readonly sheet = input.required<ParticipantSheetDto>();
  /** Le créneau choisi ; à défaut, ou fermé, le premier créneau ouvert. */
  readonly timeSlotId = model<string | undefined>(undefined);
  /** Une écriture est enregistrée : la fiche relue. */
  readonly changed = output<ParticipantSheetDto>();
  /** Une écriture est refusée (404, 409, 422) : la fiche est à relire. */
  readonly refused = output<void>();

  /** Une écriture à la fois par partie ; un refus part en alerte. */
  protected readonly writes = injectGesture({ alert: true });

  private readonly store = inject(ConventionStore);
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly trackingResource = apiResource(signUpTrackingEndpoints.read);
  protected readonly tracking = currentValue(this.trackingResource);

  /** Les créneaux ouverts du pseudo, avec leur libellé. */
  protected readonly openSlots = computed(() => {
    const slots = new Map(this.store.timeSlots().map((slot) => [slot.id, slot]));
    return this.sheet()
      .timeSlots.filter(({ state }) => state === 'sign-ups-open')
      .map((row) => {
        const slot = slots.get(row.timeSlotId);
        return { ...row, label: slot ? timeSlotLabel(slot) : fr`Créneau ${row.rank}` };
      });
  });

  protected readonly current = computed(
    () =>
      this.openSlots().find(({ timeSlotId }) => timeSlotId === this.timeSlotId()) ??
      this.openSlots()[0],
  );

  /** Les parties qui commencent sur le créneau, dans l'ordre de leur programmation. */
  protected readonly lines = computed(() => {
    const slot = this.current();
    if (!slot) return [];
    return (this.tracking()?.games ?? [])
      .filter(({ timeSlotIds }) => timeSlotIds[0] === slot.timeSlotId)
      .map((game) => ({ game, own: game.id === slot.ledGameId }));
  });

  /** Le titre de la partie qu'il mène sur le créneau, ou `undefined`. */
  protected readonly ledTitle = computed(() => {
    const ledGameId = this.current()?.ledGameId;
    return this.tracking()?.games.find(({ id }) => id === ledGameId)?.scenario.title;
  });

  /** Inscrit, en actif ou en secours. Pendant son écriture, la case montre l'état demandé. */
  private isSaved(gameId: string): boolean {
    const { signedUpGameIds, backupGameIds } = this.sheet();
    return signedUpGameIds.includes(gameId) || backupGameIds.includes(gameId);
  }

  protected isChecked(gameId: string): boolean {
    const saved = this.isSaved(gameId);
    return this.writes.isRunning(gameId) ? !saved : saved;
  }

  protected withdrawKey(timeSlotId: string): string {
    return WITHDRAW_FROM_DRAW + timeSlotId;
  }

  protected onChange(game: TrackedGameDto, box: HTMLInputElement): void {
    // Une seule écriture à la fois par partie : un second clic pendant l'écriture est sans effet.
    if (this.writes.isRunning(game.id)) {
      box.checked = this.isChecked(game.id);
      return;
    }
    const signUp = box.checked;
    const params = { participantId: this.sheet().id, gameId: game.id };
    const title = game.scenario.title;
    void this.write(
      game.id,
      () =>
        this.apiCall(signUp ? participantEndpoints.signUp : participantEndpoints.withdraw, {
          params,
        }),
      signUp ? fr`Inscrit à « ${title} ».` : fr`Désinscrit de « ${title} ».`,
    );
  }

  protected withdrawFromDraw(timeSlotId: string, rank: number): void {
    const params = { participantId: this.sheet().id, timeSlotId };
    void this.write(
      this.withdrawKey(timeSlotId),
      () => this.apiCall(participantEndpoints.withdrawFromDraw, { params }),
      fr`Retiré du tirage du créneau ${rank}.`,
    );
  }

  /** Enregistre, puis relit les chiffres des parties. */
  private async write(
    key: string,
    action: () => Promise<ParticipantSheetDto>,
    announcement: string,
  ): Promise<void> {
    const outcome = await this.writes.run(action, key);
    if (outcome.status === 'done') {
      this.changed.emit(outcome.value);
      this.announcer.announce(announcement);
    } else if (outcome.status === 'refused' && outcome.refusal.stale) {
      this.refused.emit();
    }
    if (outcome.status !== 'busy') this.trackingResource.reload();
  }
}
