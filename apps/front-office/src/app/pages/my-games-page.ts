import { afterRenderEffect, Component, ElementRef, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TIME_SLOT_PARAM } from '@chimeres/contract';
import { formatTimeRange, fr } from '@chimeres/design';
import { doubleGameRanksOf, timeSlotsOf } from '../game/game-text';
import { LedGameCard } from '../game/led-game-card';
import { OversubscribedBadge } from '../game/oversubscribed-badge';
import { OversubscribedReminder } from '../game/oversubscribed-reminder';
import { ParticipantData } from '../participant-data/participant-data';
import { ScenarioIllustration } from '../scenario-illustration';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';

/**
 * Mes parties, créneau par créneau à venir : le rappel d'IN-5, les inscriptions du pseudo, chacune
 * vers sa fiche, puis sa table ou « Pas de place pour toi » après la publication (story 86). Sur un
 * créneau où son MJ mène, la partie menée s'y déplie (§5.7). Sur un créneau aux inscriptions
 * ouvertes où il est sans partie, ce qu'il peut faire, et « Me retirer du tirage » (IN-6). `?creneau=2` fait défiler jusqu'au
 * créneau 2.
 */
@Component({
  selector: 'app-my-games-page',
  imports: [
    Button,
    Icon,
    LedGameCard,
    OversubscribedBadge,
    OversubscribedReminder,
    RouterLink,
    ScenarioIllustration,
  ],
  template: `
    <h1 class="visually-hidden">Mes parties</h1>
    @if (data.schedule(); as schedule) {
      @for (slot of data.myTimeSlots(); track slot.timeSlot.id) {
        <section [attr.aria-labelledby]="'time-slot-' + slot.timeSlot.rank">
          <h2 [id]="'time-slot-' + slot.timeSlot.rank">
            Créneau {{ slot.timeSlot.rank }}
            <span class="range">{{ formatTimeRange(slot.timeSlot.start, slot.timeSlot.end) }}</span>
          </h2>
          @if (slot.onlySignUpOversubscribed) {
            <app-oversubscribed-reminder [rank]="slot.timeSlot.rank" />
          }
          @if (slot.led; as led) {
            <app-led-game-card
              [led]="led"
              [startTime]="timeSlotsOf(schedule, led.game)[0]!.start"
            />
          } @else if (slot.signedUpGames.length) {
            <ul aria-label="Tes inscriptions">
              @for (game of slot.signedUpGames; track game.id) {
                <li>
                  <a [routerLink]="['/parties', game.id]">
                    <span class="text">
                      <span class="title">{{ game.title }}</span>
                      <span class="meta">
                        Table {{ game.tableName }}
                        @if (doubleGameRanksOf(schedule, game); as ranks) {
                          · {{ ranks }}
                        }
                      </span>
                      @if (game.oversubscribed) {
                        <app-oversubscribed-badge />
                      }
                    </span>
                    <app-scenario-illustration
                      format="thumb"
                      [title]="game.title"
                      [imageUrl]="game.imageUrl"
                    />
                  </a>
                </li>
              }
            </ul>
          } @else if (slot.withoutGame) {
            <div class="without-game">
              <p>{{ withoutGameText(slot.timeSlot.rank) }}</p>
              <div>
                <button
                  type="button"
                  appButton="secondary"
                  [attr.aria-disabled]="data.isWithdrawingFromDraw(slot.timeSlot.id) || null"
                  (click)="data.withdrawFromDraw(slot.timeSlot.id)"
                >
                  Me retirer du tirage
                </button>
              </div>
            </div>
          } @else {
            <p class="empty">Aucune inscription sur ce créneau.</p>
          }
          @if (slot.assignment; as assignment) {
            @if (assignment.kind === 'assigned') {
              <a class="outcome success" [routerLink]="['/parties', assignment.game.id]">
                <app-icon name="circle-check" />
                <span>
                  <span class="over">Table {{ assignment.game.tableName }}</span>
                  <span class="title">
                    Tu joues à {{ assignment.game.title }}, avec
                    {{ assignment.game.gameMasterNickname }}
                  </span>
                </span>
              </a>
            } @else {
              <p class="outcome warning">
                <app-icon name="triangle-alert" /><span class="title">Pas de place pour toi</span>
              </p>
            }
          }
        </section>
      } @empty {
        <p class="empty">Le programme n'est pas encore prêt. Reviens un peu plus tard.</p>
      }
    } @else {
      <p>Chargement…</p>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: grid;
        gap: var(--space-l);
      }

      section {
        display: grid;
        gap: var(--space-s);
        scroll-margin-top: calc(var(--bar-height) + var(--space-m));
      }

      h2 {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);
        align-items: baseline;
        font-size: var(--font-size-mobile-block);
      }

      .range,
      .meta,
      .empty {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
        font-weight: normal;
      }

      .range {
        font-variant-numeric: tabular-nums;
      }

      ul {
        display: grid;
        gap: var(--space-s);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      ul a,
      .outcome {
        padding: var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);
        color: var(--text);
        text-decoration: none;
      }

      /* Le texte à gauche, la vignette de l'image à droite. */
      ul a {
        display: flex;
        gap: var(--space-m);
        align-items: center;
        justify-content: space-between;
      }

      .text {
        display: grid;
        gap: var(--space-xxs);
        justify-items: start;
      }

      app-scenario-illustration {
        flex: none;
        width: 44px;
      }

      .outcome {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;

        > span {
          display: grid;
          gap: var(--space-xxs);
        }
      }

      .without-game {
        display: grid;
        gap: var(--space-m);
        padding: var(--space-m);
        border: 1px solid color-mix(in srgb, var(--warning) 50%, var(--border));
        border-radius: var(--radius-card);
        background: var(--surface-2);

        p {
          margin: 0;
        }
      }

      [aria-disabled='true'] {
        cursor: progress;
      }

      .success app-icon {
        color: var(--success);
      }

      .warning app-icon {
        color: var(--warning);
      }

      .title {
        font-weight: 600;
        line-height: var(--line-height-title);
      }
    }
  `,
})
export class MyGamesPage {
  protected readonly data = inject(ParticipantData);
  protected readonly formatTimeRange = formatTimeRange;
  protected readonly doubleGameRanksOf = doubleGameRanksOf;
  protected readonly timeSlotsOf = timeSlotsOf;

  /** Le pseudo sans partie sur le créneau : ce qui lui est arrivé, et ce qu'il peut faire (IN-6). */
  protected withoutGameText(rank: number): string {
    return fr`Toutes tes parties ont été retirées de ce créneau. Tu restes dans le tirage du créneau ${rank} : inscris-toi à une autre partie pour avoir une table.`;
  }

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly rank = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => Number(params.get(TIME_SLOT_PARAM)))),
  );

  constructor() {
    // Une seule fois par adresse, dès que le créneau est affiché : la relecture ne fait pas défiler.
    let scrolledTo: number | undefined;
    afterRenderEffect(() => {
      const rank = this.rank();
      if (!rank || !this.data.myTimeSlots() || scrolledTo === rank) return;
      const section = this.host.nativeElement
        .querySelector(`#time-slot-${rank}`)
        ?.closest('section');
      if (!section) return;
      scrolledTo = rank;
      section.scrollIntoView({ block: 'start' });
    });
  }
}
