import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FrontOfficeGameDto, FrontOfficeScheduleDto } from '@chimeres/contract';
import { ParticipantData } from '../participant-data/participant-data';
import { ScenarioIllustration } from '../scenario-illustration';
import { Icon } from '../ui/icon';
import { formatTimeSlotRanks } from '@chimeres/design';
import { counterOf, ranksOf } from './game-text';
import { OversubscribedBadge } from './oversubscribed-badge';

/**
 * Une partie du programme, en carte 3:2 qui ouvre sa fiche : l'image, puis par-dessus la table, le
 * titre, le jeu et le MJ, le compteur et « Très demandée ». Un badge « Inscrit » se pose sur
 * l'image d'une partie où le pseudo est inscrit.
 */
@Component({
  selector: 'app-game-card',
  imports: [Icon, OversubscribedBadge, RouterLink, ScenarioIllustration],
  template: `
    <a [routerLink]="['/parties', game().id]">
      <app-scenario-illustration
        format="card"
        [title]="game().title"
        [imageUrl]="game().imageUrl"
      />
      @if (signedUp()) {
        <span class="signed-up"><app-icon name="check" />Inscrit</span>
      }
      <span class="text">
        <span class="over">
          Table {{ game().tableName }}
          @if (doubleRanks(); as ranks) {
            · {{ ranks }}
          }
        </span>
        <span class="title">{{ game().title }}</span>
        <span class="meta">{{ game().system }} · avec {{ game().gameMasterNickname }}</span>
        <span class="counter">
          <span class="meta">{{ counter() }}</span>
          @if (game().oversubscribed) {
            <app-oversubscribed-badge />
          }
        </span>
      </span>
    </a>
  `,
  styles: `
    @layer components {
      a {
        display: grid;
        /* La carte grandit si son texte dépasse : overflow: clip garde sa hauteur minimale automatique. */
        aspect-ratio: 3 / 2;
        overflow: clip;
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);
        color: var(--text);
        text-decoration: none;
      }

      app-scenario-illustration,
      .signed-up,
      .text {
        grid-area: 1 / 1;
      }

      .signed-up {
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
      }

      .signed-up app-icon ::ng-deep svg {
        width: 1rem;
        height: 1rem;
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
        /* Le texte se lit sur l'image : un dégradé vers le fond de page. */
        background: linear-gradient(
          to bottom,
          transparent,
          color-mix(in srgb, var(--surface-0) 94%, transparent) 45%
        );
      }

      .over {
        color: var(--text-muted);
        font-family: var(--font-caps);
        font-size: var(--font-size-mobile-overline);
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .title {
        font-size: var(--font-size-mobile-block);
        font-weight: 600;
        line-height: var(--line-height-title);
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }

      .counter {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);
        align-items: center;
        font-variant-numeric: tabular-nums;
      }
    }
  `,
})
export class GameCard {
  readonly game = input.required<FrontOfficeGameDto>();
  readonly schedule = input.required<FrontOfficeScheduleDto>();

  private readonly data = inject(ParticipantData);

  protected readonly counter = computed(() => counterOf(this.game()));
  protected readonly signedUp = computed(() => this.data.isSignedUp(this.game().id));
  /** « créneaux 1 et 2 » pour une partie double, sinon rien : la carte est sous son créneau. */
  protected readonly doubleRanks = computed(() => {
    const ranks = ranksOf(this.schedule(), this.game());
    return ranks.length > 1 ? formatTimeSlotRanks(ranks) : null;
  });
}
