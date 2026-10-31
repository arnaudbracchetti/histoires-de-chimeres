import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FrontOfficeGameDto } from '@chimeres/contract';
import { countOf, plural } from '@chimeres/design';
import { ScenarioIllustration } from '../scenario-illustration';

/**
 * Les parties d'un créneau publié où il reste de la place, chacune vers sa fiche : la vignette,
 * « Table Dragon », « *Titre*, avec *MJ* », et « 2 places libres » en vert. Pour un non placé
 * (story 55) et pour le MJ d'une partie annulée (TI-6).
 */
@Component({
  selector: 'app-games-with-seats',
  imports: [RouterLink, ScenarioIllustration],
  template: `
    <ul aria-label="Parties où il reste de la place">
      @for (game of games(); track game.id) {
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
  `,
  styles: `
    @layer components {
      ul {
        display: grid;
        gap: var(--space-s);
        margin: 0;
        padding: 0;
        list-style: none;
      }

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

      .title {
        font-weight: 600;
        line-height: var(--line-height-title);
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }

      .seats {
        color: var(--success);
        font-size: var(--font-size-mobile-meta);
        font-weight: 600;
        white-space: nowrap;
      }
    }
  `,
})
export class GamesWithSeats {
  readonly games = input.required<FrontOfficeGameDto[]>();

  /** « 2 places libres ». */
  protected seatsLeftOf({ seats, playerCount }: FrontOfficeGameDto): string {
    const left = seats.max - (playerCount ?? 0);
    return `${countOf(left, 'place', 'places')} ${plural(left, 'libre', 'libres')}`;
  }
}
