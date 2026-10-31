import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { countOf, formatSeats, formatTime, fr } from '@chimeres/design';
import type { LedGame } from '../participant-data/participant-data';
import { ScenarioIllustration } from '../scenario-illustration';
import { Icon } from '../ui/icon';
import { cancelledGameText, playersOf, signUpCountOf, signUpsForSeatsOf } from './game-text';
import { GamesWithSeats } from './games-with-seats';
import { OversubscribedBadge } from './oversubscribed-badge';

/**
 * La partie que mène le MJ, dépliée dans Mes parties sur son créneau (§5.7, variante B de #54) :
 * table, titre vers la fiche, jeu, heure de début ou « Maintenant ». Puis, selon son tirage, le
 * nombre d'inscrits sans leurs pseudos, « Tirage en cours », ses joueurs, ou « Partie annulée »
 * avec les tables où il reste de la place.
 */
@Component({
  selector: 'app-led-game-card',
  imports: [GamesWithSeats, Icon, OversubscribedBadge, RouterLink, ScenarioIllustration],
  template: `
    @let game = led().game;
    <div class="head">
      <app-scenario-illustration format="thumb" [title]="game.title" [imageUrl]="game.imageUrl" />
      <span class="text">
        <span class="over">Tu mènes</span>
        <span class="table">Table {{ game.tableName }}</span>
        <a class="title" [routerLink]="['/parties', game.id]">{{ game.title }}</a>
        <span class="meta">{{ game.system }}</span>
      </span>
    </div>
    @let outcome = led().outcome;
    @if (outcome.kind === 'cancelled') {
      <p class="status warning">
        <app-icon name="triangle-alert" /><strong>Partie annulée</strong>
      </p>
      <p>{{ cancelledText() }}</p>
      @if (outcome.gamesWithSeats.length) {
        <app-games-with-seats [games]="outcome.gamesWithSeats" />
      }
    } @else {
      <p class="when">
        <app-icon name="clock" />{{ led().started ? 'Maintenant' : 'Début à ' + start() }}
      </p>
      @if (outcome.kind === 'players') {
        <h3 class="over">{{ playersHeading() }}</h3>
        <ul aria-label="Tes joueurs">
          @for (player of outcome.players; track player) {
            <li>
              <span class="initial" aria-hidden="true">{{ initialOfNickname(player) }}</span>
              {{ player }}
            </li>
          }
        </ul>
      } @else if (outcome.kind === 'drawing') {
        <p class="status"><app-icon name="hourglass" /><strong>Tirage en cours</strong></p>
        <p class="meta">{{ drawingText() }}</p>
      } @else {
        <p class="counter">
          <span
            ><strong>{{ signUps() }}</strong
            ><span class="meta"> · {{ seats() }}</span></span
          >
          @if (game.oversubscribed) {
            <app-oversubscribed-badge />
          }
        </p>
        <p class="meta">Tes joueurs s'afficheront ici à la publication du tirage.</p>
      }
    }
  `,
  styles: `
    @layer components {
      :host {
        display: grid;
        gap: var(--space-s);
        padding: var(--space-m);
        border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
        border-radius: var(--radius-card);
        background: var(--surface-2);
      }

      p {
        margin: 0;
      }

      .head {
        display: flex;
        gap: var(--space-m);
        align-items: center;
      }

      app-scenario-illustration {
        flex: none;
        width: 48px;
      }

      .text {
        display: grid;
        gap: var(--space-xxs);
      }

      .table {
        font-size: var(--font-size-mobile-block);
        font-weight: 600;
        line-height: var(--line-height-title);
      }

      .title {
        color: var(--accent);
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }

      .when,
      .status,
      .counter {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);
        align-items: center;
        font-variant-numeric: tabular-nums;
      }

      .when {
        color: var(--accent);
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
      }

      .status app-icon {
        color: var(--text-muted);
      }

      .warning app-icon {
        color: var(--warning);
      }

      ul {
        display: grid;
        gap: var(--space-xs);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: flex;
        gap: var(--space-s);
        align-items: center;
      }

      .initial {
        display: inline-grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 50%;
        background: color-mix(in srgb, var(--accent) 14%, var(--surface-3));
        color: var(--accent);
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
      }
    }
  `,
})
export class LedGameCard {
  readonly led = input.required<LedGame>();
  /** Le début de la partie, `HH:MM`. */
  readonly startTime = input.required<string>();

  protected readonly start = computed(() => formatTime(this.startTime()));
  protected readonly seats = computed(() => formatSeats(this.led().game.seats));
  /** « 7 inscrits », « Aucun inscrit » : sans leurs pseudos (§5.7). */
  protected readonly signUps = computed(() => signUpCountOf(this.led().game));
  protected readonly drawingText = computed(
    () =>
      fr`Les inscriptions sont fermées : ${signUpsForSeatsOf(this.led().game)}. Tes joueurs s'afficheront ici à la publication.`,
  );
  protected readonly playersHeading = computed(() => {
    const players = playersOf(this.led()).length;
    const heading =
      players > 1
        ? `Tes ${countOf(players, 'joueur', 'joueurs')}`
        : players
          ? 'Ton joueur'
          : 'Aucun joueur';
    return `${heading} · ${this.seats()}`;
  });
  protected readonly cancelledText = computed(() => cancelledGameText(this.led()));

  protected initialOfNickname(nickname: string): string {
    return nickname.trim().charAt(0).toLocaleUpperCase('fr');
  }
}
