import { Component, computed, input } from '@angular/core';
import type { TimeSlotStateDto, TimeSlotTrackingDto, TrackedGameDto } from '@chimeres/contract';
import { countOf, formatCount, formatList, formatSeats, fr } from '@chimeres/design';
import { Gauge } from '../ui/gauge';
import { GameBadges } from './game-badges';
import { ParticipantRiskPill } from './participant-risk-pill';

/** Ce que dit la section d'une partie dont le créneau est fermé. */
const CLOSED: Record<Exclude<TimeSlotStateDto, 'sign-ups-open'>, string> = {
  drawing: fr`Tirage en cours : les inscriptions sont fermées.`,
  published: fr`Tirage publié : les inscriptions sont fermées.`,
};

/**
 * La section « Inscrits » de la fiche de la partie, sur la page de pilotage (docs/design/patterns.md,
 * Fiche de la partie) : ses chiffres, comme sur sa ligne, puis ses pseudos en deux groupes, ceux
 * sans autre inscription sur le créneau d'abord, chacun avec sa pastille. Les pseudos viennent des
 * participants du premier créneau de la partie, dans l'ordre reçu.
 */
@Component({
  selector: 'app-tracked-game-sign-ups',
  imports: [GameBadges, Gauge, ParticipantRiskPill],
  template: `
    <section class="sign-ups" aria-labelledby="game-sheet-sign-ups">
      <h3 id="game-sheet-sign-ups">Inscrits</h3>
      @if (closed(); as closed) {
        <p class="quiet">{{ closed }}</p>
      }
      @if (doubleRank(); as rank) {
        <p class="quiet">{{ doubleText(rank) }}</p>
      }
      <p>{{ countOf(game().signUpCount, 'inscrit', 'inscrits') }} · {{ formatSeats(game().seats) }}</p>
      <app-gauge
        [count]="game().signUpCount"
        [min]="game().seats.min"
        [max]="game().seats.max"
        [shortfall]="game().belowMinimum"
      />
      <app-game-badges [game]="game()" />
      @if (game().withoutOtherSignUpCount) {
        <p class="quiet">
          dont {{ formatCount(game().withoutOtherSignUpCount) }} sans autre inscription sur le
          créneau
        </p>
      }
      @if (!alone().length && !elsewhere().length) {
        <p class="quiet">Aucun inscrit pour l'instant.</p>
      }
      @if (alone().length) {
        <h4>Sans autre inscription sur le créneau · {{ formatCount(alone().length) }}</h4>
        <ul>
          @for (participant of alone(); track participant.id) {
            <li>
              <span class="nickname">{{ participant.nickname }}</span>
              @if (participant.risk) {
                <app-participant-risk-pill [risk]="participant.risk" />
              }
            </li>
          }
        </ul>
      }
      @if (elsewhere().length) {
        <h4>Inscrits aussi ailleurs sur le créneau · {{ formatCount(elsewhere().length) }}</h4>
        <ul>
          @for (participant of elsewhere(); track participant.id) {
            <li>
              <span class="nickname">{{ participant.nickname }}</span>
              <span class="quiet">{{ participant.also }}</span>
              @if (participant.risk) {
                <app-participant-risk-pill [risk]="participant.risk" />
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    @layer components {
      .sign-ups {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        padding-top: var(--space-m);
        border-top: 1px solid var(--border);
      }

      h3,
      h4,
      p {
        margin: 0;
      }

      h3 {
        font-family: var(--font-ui);
        font-size: var(--font-size-block);
        font-weight: 600;
      }

      h4 {
        margin-top: var(--space-xs);
        color: var(--text-muted);
        font-size: var(--font-size-meta);
        font-weight: 600;
      }

      ul {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs) var(--space-s);
        align-items: baseline;
      }

      .nickname {
        font-weight: 600;
      }

      .quiet {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class TrackedGameSignUps {
  readonly game = input.required<TrackedGameDto>();
  /** Dans l'ordre de la journée. */
  readonly timeSlots = input.required<readonly TimeSlotTrackingDto[]>();
  /** Pour les titres des autres parties où ses inscrits le sont aussi. */
  readonly games = input.required<readonly TrackedGameDto[]>();

  protected readonly countOf = countOf;
  protected readonly formatCount = formatCount;
  protected readonly formatSeats = formatSeats;

  /** Le premier créneau de la partie : ses inscriptions y comptent. */
  private readonly timeSlot = computed(() =>
    this.timeSlots().find(({ id }) => id === this.game().timeSlotIds[0]),
  );

  protected readonly closed = computed(() => {
    const state = this.timeSlot()?.state;
    return state && state !== 'sign-ups-open' ? CLOSED[state] : undefined;
  });

  /** Le rang du premier créneau d'une partie double, ou `undefined`. */
  protected readonly doubleRank = computed(() =>
    this.game().timeSlotIds.length > 1 ? this.timeSlot()?.rank : undefined,
  );

  private readonly signedUp = computed(() =>
    (this.timeSlot()?.participants ?? []).filter(({ gameIds }) =>
      gameIds.includes(this.game().id),
    ),
  );

  protected readonly alone = computed(() =>
    this.signedUp().filter(({ gameIds }) => gameIds.length === 1),
  );

  /** Ceux inscrits aussi ailleurs sur le créneau, avec « aussi : « Sous la surface » ». */
  protected readonly elsewhere = computed(() =>
    this.signedUp()
      .filter(({ gameIds }) => gameIds.length > 1)
      .map((participant) => ({
        ...participant,
        also: fr`aussi : ${formatList(
          participant.gameIds
            .filter((id) => id !== this.game().id)
            .flatMap((id) => {
              const title = this.games().find((game) => game.id === id)?.scenario.title;
              return title ? [fr`« ${title} »`] : [];
            }),
        )}`,
      })),
  );

  protected doubleText(rank: number): string {
    return fr`Partie double : ses inscriptions comptent sur le créneau ${rank}.`;
  }
}
