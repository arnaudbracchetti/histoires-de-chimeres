import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  frontOfficePaths,
  frontOfficeUrls,
  TIME_SLOT_PARAM,
  type FrontOfficeGameDto,
  type FrontOfficeScheduleDto,
} from '@chimeres/contract';
import { formatTime, formatTimeSlotRanks, fr } from '@chimeres/design';
import { ParticipantData } from '../participant-data/participant-data';
import { TabNavigation } from '../shell/tab-navigation';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { ranksOf, timeSlotsOf } from './game-text';

/** Un statut de la barre : son icône, son ton, son titre, sa phrase, et la partie à voir. */
type Status = {
  icon: string;
  tone: 'accent' | 'success' | 'warning' | 'muted';
  title: string;
  detail: string;
  /** « Voir ta partie » : la fiche de la partie où le pseudo joue. */
  seeGameId?: string;
  /** « Voir dans Mes parties » : Mes parties, sur ce créneau (§5.7). */
  seeMyGamesRank?: number;
};

/**
 * La barre fixée en bas de la fiche d'une partie (§5.3, variante A de #63) : « S'inscrire », ou
 * « Inscription enregistrée » et « Se désinscrire », toujours à portée du pouce. Quand le geste est
 * impossible, elle dit pourquoi à la place du bouton. Le bouton reste actif sans réseau : l'échec
 * se dit en alerte.
 */
@Component({
  selector: 'app-sign-up-bar',
  imports: [Button, Icon, RouterLink],
  template: `
    <div class="content" aria-live="polite">
      @if (bar(); as bar) {
        @if (bar.kind === 'open') {
          @if (bar.signedUp) {
            <div class="split">
              <p class="status accent">
                <app-icon name="circle-check" /><strong>Inscription enregistrée</strong>
              </p>
              <button
                type="button"
                appButton="secondary"
                [attr.aria-disabled]="bar.pending || null"
                (click)="data.withdraw(game().id)"
              >
                {{ bar.pending ? 'Désinscription…' : 'Se désinscrire' }}
              </button>
            </div>
          } @else {
            <button
              type="button"
              appButton="primary"
              class="block"
              [attr.aria-disabled]="bar.pending || null"
              (click)="data.signUp(game().id)"
            >
              @if (!bar.pending) {
                <app-icon name="plus" />
              }
              {{ bar.pending ? 'Inscription…' : "S'inscrire" }}
            </button>
          }
        } @else if (status(); as status) {
          <div class="status" [class]="status.tone">
            <app-icon [name]="status.icon" />
            <div>
              <p>
                <strong>{{ status.title }}</strong>
              </p>
              <p class="detail">{{ status.detail }}</p>
            </div>
          </div>
          @if (status.seeGameId) {
            <a [routerLink]="['/parties', status.seeGameId]" appButton="secondary" class="block">
              Voir ta partie
            </a>
          }
          @if (status.seeMyGamesRank) {
            <a
              [href]="myGamesUrl(status.seeMyGamesRank)"
              appButton="secondary"
              class="block"
              (click)="$event.preventDefault(); openMyGames(status.seeMyGamesRank)"
            >
              <app-icon name="book-open" />Voir dans Mes parties
            </a>
          }
        }
      }
    </div>
  `,
  styles: `
    @layer components {
      :host {
        position: sticky;
        bottom: 0;
        margin-top: auto;
        border-top: 1px solid var(--border);
        background: var(--surface-1);
      }

      .content {
        display: grid;
        gap: var(--space-s);
        width: 100%;
        max-width: var(--content-width);
        margin-inline: auto;
        padding: var(--space-m) var(--gutter) max(env(safe-area-inset-bottom), var(--space-m));
      }

      .block {
        width: 100%;
      }

      .split {
        display: flex;
        gap: var(--space-m);
        align-items: center;
        justify-content: space-between;
      }

      .status {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
      }

      .split .status {
        align-items: center;
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
      .detail {
        color: var(--text-muted);
      }

      [aria-disabled='true'] {
        cursor: progress;
      }
    }
  `,
})
export class SignUpBar {
  readonly game = input.required<FrontOfficeGameDto>();
  readonly schedule = input.required<FrontOfficeScheduleDto>();

  protected readonly data = inject(ParticipantData);
  protected readonly myGamesUrl = frontOfficeUrls.myGamesOnTimeSlot;

  private readonly navigation = inject(TabNavigation);
  protected readonly bar = computed(() => this.data.signUpBarOf(this.game().id));

  /** Pourquoi le geste est impossible, quand il l'est. */
  protected readonly status = computed<Status | null>(() => {
    const bar = this.bar();
    const schedule = this.schedule();
    const game = this.game();
    switch (bar?.kind) {
      case undefined:
      case 'open':
        return null;
      case 'own-game':
        return {
          icon: 'book-open',
          tone: 'accent',
          title: 'Tu mènes cette partie',
          detail: 'Ses inscrits, puis ses joueurs, sont dans Mes parties.',
          seeMyGamesRank: bar.rank,
        };
      case 'leading':
        return {
          icon: 'book-open',
          tone: 'accent',
          title: 'Tu mènes une partie sur ce créneau',
          detail: fr`${bar.game.title}, table ${bar.game.tableName} : tu ne peux pas t'inscrire comme joueur.`,
        };
      case 'held': {
        const ranks = formatTimeSlotRanks(ranksOf(schedule, bar.game));
        return {
          icon: 'circle-check',
          tone: 'success',
          title: fr`Tu joues aux ${ranks}`,
          detail:
            fr`${bar.game.title}, table ${bar.game.tableName} : tu ne peux pas t'inscrire sur ce créneau.` +
            (bar.signedUp ? fr` Ton inscription à cette partie ne compte plus.` : ''),
          seeGameId: bar.game.id,
        };
      }
      case 'drawing':
        return {
          icon: 'hourglass',
          tone: 'muted',
          title: 'Tirage en cours',
          detail:
            fr`Les inscriptions du créneau ${bar.rank} sont fermées.` +
            (bar.signedUp ? fr` Ton inscription compte pour ce tirage.` : ''),
        };
      case 'assigned-here':
        return {
          icon: 'circle-check',
          tone: 'success',
          title: 'Tu joues à cette table',
          detail: fr`Table ${game.tableName} · début à ${formatTime(timeSlotsOf(schedule, game)[0]!.start)}`,
        };
      case 'assigned-elsewhere':
        return {
          icon: 'circle-check',
          tone: 'muted',
          title: 'Tirage publié',
          detail: fr`Tu joues à la table ${bar.game.tableName} : ${bar.game.title}.`,
          seeGameId: bar.game.id,
        };
      case 'unassigned':
        return {
          icon: 'triangle-alert',
          tone: 'warning',
          title: 'Pas de place pour toi',
          detail: fr`Tirage publié : les parties que tu avais choisies sont complètes.`,
        };
      case 'closed':
        return {
          icon: 'circle-check',
          tone: 'muted',
          title: 'Tirage publié',
          detail: fr`Les inscriptions du créneau ${bar.rank} sont fermées.`,
        };
    }
  });

  /** Mes parties, sur le créneau de sa partie : un onglet, qui ne s'empile pas (§5.7). */
  protected openMyGames(rank: number): void {
    this.navigation.go(frontOfficePaths.myGames, { [TIME_SLOT_PARAM]: rank });
  }
}
