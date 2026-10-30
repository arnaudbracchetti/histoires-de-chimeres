import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  frontOfficePaths,
  frontOfficeUrls,
  TIME_SLOT_PARAM,
  type FrontOfficeGameDto,
} from '@chimeres/contract';
import { countOf, formatList, formatTime, fr, plural, timeSlotLabel } from '@chimeres/design';
import { timeSlotsLabel } from '../game/game-text';
import { OversubscribedReminder } from '../game/oversubscribed-reminder';
import { ParticipantData, type MyTimeSlot } from '../participant-data/participant-data';
import { ScenarioIllustration } from '../scenario-illustration';
import { TabNavigation } from '../shell/tab-navigation';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';

/** Une ligne de « Ton programme » : l'état du créneau pour le pseudo (story 60). */
type ProgrammeLine = {
  icon: string;
  tone: 'accent' | 'success' | 'warning' | 'muted';
  label: string;
  detail: string;
};

/**
 * L'Accueil, racine de l'historique : en tête, la dernière affectation publiée ou une carte d'état
 * (stories 54, 55, 57, 59), puis « Ton programme », une ligne par autre créneau à venir, qui mène à
 * la fiche de sa table ou au programme du créneau, avec le rappel d'IN-5 (stories 60, 61).
 */
@Component({
  selector: 'app-home-page',
  imports: [Button, Icon, OversubscribedReminder, RouterLink, ScenarioIllustration],
  template: `
    <h1 class="visually-hidden">Accueil</h1>
    @if (data.home(); as home) {
      @let card = home.card;
      @if (card.kind === 'assigned') {
        <a class="assignment" [routerLink]="['/parties', card.game.id]">
          <app-scenario-illustration
            format="card"
            [title]="card.game.title"
            [imageUrl]="card.game.imageUrl"
          />
          <span class="when">
            <app-icon name="clock" />
            {{ card.started ? 'Maintenant' : 'Début à ' + formatTime(card.timeSlots[0]!.start) }}
          </span>
          <span class="text">
            <span class="over">{{ timeSlotsLabel(card.timeSlots) }}</span>
            <span class="table">Table {{ card.game.tableName }}</span>
            <span>
              Tu joues à <strong>{{ card.game.title }}</strong
              >, avec
              {{ card.game.gameMasterNickname }}
            </span>
            <span class="meta">{{ card.game.system }}</span>
          </span>
        </a>
      } @else if (card.kind === 'unassigned') {
        <section class="card warning" aria-labelledby="unassigned">
          <span class="over">{{ timeSlotLabel(card.timeSlot) }}</span>
          <h2 id="unassigned">Pas de place pour toi</h2>
          <p>{{ unassignedText(card.gamesWithSeats) }}</p>
          @if (card.gamesWithSeats.length) {
            <ul aria-label="Parties où il reste de la place">
              @for (game of card.gamesWithSeats; track game.id) {
                <li>
                  <a [routerLink]="['/parties', game.id]">
                    <app-scenario-illustration
                      format="thumb"
                      [title]="game.title"
                      [imageUrl]="game.imageUrl"
                    />
                    <span class="text">
                      <span class="title">Table {{ game.tableName }}</span>
                      <span class="meta">{{ game.title }}, avec {{ game.gameMasterNickname }}</span>
                    </span>
                    <span class="seats">{{ seatsLeftOf(game) }}</span>
                  </a>
                </li>
              }
            </ul>
          }
        </section>
      } @else if (card.kind === 'drawing') {
        <section class="card" aria-labelledby="drawing">
          <span class="over">{{ timeSlotLabel(card.timeSlot) }}</span>
          <h2 id="drawing">Tirage en cours</h2>
          <p>{{ drawingText(card.signedUpGames) }}</p>
          <p class="meta">Ta table s'affichera ici dès la publication.</p>
        </section>
      } @else {
        <section class="card" aria-labelledby="choose-games">
          <span class="over">Inscriptions ouvertes</span>
          <h2 id="choose-games">Choisis tes parties</h2>
          <p>
            Inscris-toi à autant de parties que tu veux, sur chaque créneau. Chaque créneau est tiré
            au sort peu avant son début.
          </p>
          <div>
            <a
              href="/programme"
              appButton="primary"
              (click)="$event.preventDefault(); navigation.go('programme')"
            >
              Voir le programme
            </a>
          </div>
        </section>
      }
      @if (home.timeSlots.length) {
        <section class="programme" aria-labelledby="your-programme">
          <h2 id="your-programme">Ton programme</h2>
          <ul>
            @for (slot of home.timeSlots; track slot.timeSlot.id) {
              @let line = lineOf(slot);
              <li>
                <a [href]="hrefOf(slot)" (click)="$event.preventDefault(); open(slot)">
                  <span class="line">
                    <span class="over">
                      Créneau {{ slot.timeSlot.rank }} · {{ formatTime(slot.timeSlot.start) }}
                    </span>
                    <span class="status" [class]="line.tone">
                      <app-icon [name]="line.icon" />
                      <span>
                        <span class="title">{{ line.label }}</span>
                        <span class="meta">{{ line.detail }}</span>
                      </span>
                    </span>
                    @if (slot.onlySignUpOversubscribed) {
                      <app-oversubscribed-reminder [rank]="slot.timeSlot.rank" />
                    }
                  </span>
                  <app-icon class="chevron" name="chevron-right" />
                </a>
              </li>
            }
          </ul>
        </section>
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

      .card {
        display: grid;
        gap: var(--space-s);
        padding: var(--space-l);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);
      }

      .card.warning {
        border-color: color-mix(in srgb, var(--warning) 50%, var(--border));
      }

      h2 {
        font-family: var(--font-display);
        font-size: var(--font-size-mobile-title);
        font-weight: normal;
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }

      .title {
        font-weight: 600;
        line-height: var(--line-height-title);
      }

      /* L'affectation : l'image en carte 3:2, l'heure dans son coin, le texte par-dessus. */
      .assignment {
        display: grid;
        aspect-ratio: 3 / 2;
        overflow: clip;
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);
        color: var(--text);
        text-decoration: none;

        > * {
          grid-area: 1 / 1;
        }

        app-scenario-illustration {
          height: 100%;
          aspect-ratio: auto;
        }

        .text {
          display: grid;
          align-self: end;
          gap: var(--space-xxs);
          padding: var(--space-xxl) var(--space-l) var(--space-l);
          background: linear-gradient(
            to bottom,
            transparent,
            color-mix(in srgb, var(--surface-0) 94%, transparent) 45%
          );
        }
      }

      .when {
        display: inline-flex;
        gap: var(--space-xs);
        align-items: center;
        align-self: start;
        justify-self: start;
        margin: var(--space-m);
        padding: var(--space-xxs) var(--space-s);
        border-radius: 999px;
        background: color-mix(in srgb, var(--accent) 14%, var(--surface-2));
        color: var(--accent);
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
        font-variant-numeric: tabular-nums;

        app-icon ::ng-deep svg {
          width: 1rem;
          height: 1rem;
        }
      }

      .table {
        font-family: var(--font-display);
        font-size: var(--font-size-mobile-hero);
        line-height: var(--line-height-display);
      }

      ul {
        display: grid;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      /* Les tables où il reste de la place : la vignette, la table et la partie, les places libres. */
      .card ul {
        gap: var(--space-s);

        a {
          display: flex;
          gap: var(--space-m);
          align-items: center;
          padding: var(--space-s);
          border-radius: var(--radius-card);
          background: var(--surface-3);
          color: var(--text);
          text-decoration: none;
        }

        app-scenario-illustration {
          flex: none;
          width: 44px;
        }

        .text {
          display: grid;
          flex: 1;
          gap: var(--space-xxs);
        }
      }

      .seats {
        color: var(--success);
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
        white-space: nowrap;
      }

      .programme {
        display: grid;
        gap: var(--space-s);

        h2 {
          font-family: var(--font-ui);
          font-size: var(--font-size-mobile-section);
          font-weight: 600;
        }

        ul {
          overflow: clip;
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          background: var(--surface-2);
        }

        li + li {
          border-top: 1px solid var(--border);
        }

        a {
          display: flex;
          gap: var(--space-m);
          align-items: center;
          justify-content: space-between;
          padding: var(--space-m);
          color: var(--text);
          text-decoration: none;
        }
      }

      .line {
        display: grid;
        gap: var(--space-xs);
      }

      .status {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;

        > span {
          display: grid;
          gap: var(--space-xxs);
        }
      }

      .accent app-icon {
        color: var(--accent);
      }

      .success app-icon {
        color: var(--success);
      }

      .warning app-icon {
        color: var(--warning);
      }

      .muted app-icon,
      .chevron {
        color: var(--text-muted);
      }

      /* Plus serré que dans Mes parties : il tient dans la ligne. */
      app-oversubscribed-reminder {
        padding: var(--space-s);
        border-radius: var(--radius-control);
        font-size: var(--font-size-mobile-meta);
      }
    }
  `,
})
export class HomePage {
  protected readonly data = inject(ParticipantData);
  protected readonly navigation = inject(TabNavigation);
  protected readonly formatTime = formatTime;
  protected readonly timeSlotsLabel = timeSlotsLabel;
  protected readonly timeSlotLabel = timeSlotLabel;

  private readonly router = inject(Router);

  /** Une ligne mène à la fiche de sa table, sinon au programme du créneau. */
  protected hrefOf({ timeSlot, assignment }: MyTimeSlot): string {
    return assignment?.kind === 'assigned'
      ? frontOfficeUrls.game(assignment.game.id)
      : frontOfficeUrls.timeSlotGames(timeSlot.rank);
  }

  /** La fiche s'empile sur l'Accueil ; le programme s'y pose, comme son onglet. */
  protected open({ timeSlot, assignment }: MyTimeSlot): void {
    if (assignment?.kind === 'assigned') {
      void this.router.navigateByUrl(frontOfficeUrls.game(assignment.game.id));
    } else {
      this.navigation.go(frontOfficePaths.schedule, { [TIME_SLOT_PARAM]: timeSlot.rank });
    }
  }

  /** « Pas de place pour toi » : où il reste de la place, ou que tout est complet (story 55). */
  protected unassignedText(gamesWithSeats: FrontOfficeGameDto[]): string {
    if (!gamesWithSeats.length) return seatsLeftText(gamesWithSeats);
    const gameMaster = gamesWithSeats.length > 1 ? 'leur MJ' : 'son MJ';
    return fr`Les parties que tu avais choisies sont complètes. ${seatsLeftText(gamesWithSeats)} : va voir ${gameMaster}.`;
  }

  /** « 2 places libres ». */
  protected seatsLeftOf({ seats, playerCount }: FrontOfficeGameDto): string {
    const left = seats.max - (playerCount ?? 0);
    return `${countOf(left, 'place', 'places')} ${plural(left, 'libre', 'libres')}`;
  }

  /** « Tirage en cours » : les inscriptions qui comptent pour ce tirage (story 57). */
  protected drawingText(signedUpGames: FrontOfficeGameDto[]): string {
    const titles = formatList(signedUpGames.map(({ title }) => title));
    return signedUpGames.length > 1
      ? fr`Tes ${countOf(signedUpGames.length, 'inscription', 'inscriptions')} comptent pour ce tirage : ${titles}.`
      : fr`Ton inscription compte pour ce tirage : ${titles}.`;
  }

  /** La ligne d'un créneau de « Ton programme » : son affectation, ou l'état de ses inscriptions. */
  protected lineOf({ timeSlot, state, signedUpGames, assignment }: MyTimeSlot): ProgrammeLine {
    const titles = formatList(signedUpGames.map(({ title }) => title));
    const signUps = countOf(signedUpGames.length, 'inscription', 'inscriptions');
    if (assignment?.kind === 'assigned') {
      const { game } = assignment;
      // Le second créneau d'une partie double où il joue (TI-3).
      const continued = game.timeSlotIds[0] !== timeSlot.id ? ' · suite de la partie double' : '';
      return {
        icon: 'circle-check',
        tone: 'success',
        label: `Table ${game.tableName}`,
        detail: `${game.title}, avec ${game.gameMasterNickname}${continued}`,
      };
    }
    if (assignment?.kind === 'unassigned') {
      return {
        icon: 'triangle-alert',
        tone: 'warning',
        label: 'Pas de place pour toi',
        detail: seatsLeftText(assignment.gamesWithSeats),
      };
    }
    if (state === 'drawing') {
      return {
        icon: 'hourglass',
        tone: 'muted',
        label: 'Tirage en cours',
        detail: signedUpGames.length ? fr`${signUps} : ${titles}` : 'Aucune inscription',
      };
    }
    if (state === 'published') {
      return {
        icon: 'circle-check',
        tone: 'muted',
        label: 'Tirage publié',
        detail: 'Aucune inscription sur ce créneau',
      };
    }
    return signedUpGames.length
      ? { icon: 'circle-check', tone: 'accent', label: signUps, detail: titles }
      : { icon: 'plus', tone: 'muted', label: 'Aucune inscription', detail: 'Choisir une partie' };
  }
}

/** « Il reste de la place aux tables Dragon et Licorne », ou que tout est complet (PRD §5.4). */
function seatsLeftText(gamesWithSeats: FrontOfficeGameDto[]): string {
  if (!gamesWithSeats.length) return 'Toutes les parties du créneau sont complètes.';
  const names = formatList(gamesWithSeats.map(({ tableName }) => tableName));
  return gamesWithSeats.length > 1
    ? `Il reste de la place aux tables ${names}`
    : `Il reste de la place à la table ${names}`;
}
