import { Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { renderPresentation } from '@chimeres/design/presentation';
import { ParticipantData } from '../participant-data/participant-data';
import { ScenarioIllustration } from '../scenario-illustration';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { counterOf, ranksLabelOf, timeSlotsLabelOf } from './game-text';
import { OversubscribedBadge } from './oversubscribed-badge';

/**
 * La fiche d'une partie, dans l'ordre du §5.3 : image, titre, jeu et MJ, créneau et table, compteur
 * et « Très demandée », avertissements de contenu, présentation. Elle s'empile sur l'écran qui
 * l'ouvre, sans la coquille ; son ‹ y revient.
 */
@Component({
  selector: 'app-game-page',
  imports: [Button, Icon, OversubscribedBadge, RouterLink, ScenarioIllustration],
  template: `
    <div class="bar">
      <button
        type="button"
        appButton="icon"
        aria-label="Retour"
        title="Retour"
        (click)="location.back()"
      >
        <app-icon name="chevron-left" />
      </button>
      @if (view(); as view) {
        <span class="over">{{ view.barLabel }}</span>
      }
    </div>
    <main>
      @if (view(); as view) {
        <app-scenario-illustration
          format="card"
          [title]="view.game.title"
          [imageUrl]="view.game.imageUrl"
        />
        <div class="heading">
          <h1>{{ view.game.title }}</h1>
          <p class="meta">{{ view.game.system }} · avec {{ view.game.gameMasterNickname }}</p>
          <p class="meta numbers">{{ view.slotLabel }} · table {{ view.game.tableName }}</p>
          <p class="counter">
            <span class="meta numbers">{{ view.counter }}</span>
            @if (view.game.oversubscribed) {
              <app-oversubscribed-badge />
            }
          </p>
        </div>
        @if (view.game.contentWarnings) {
          <section class="warnings" aria-labelledby="content-warnings">
            <h2 id="content-warnings" class="over">Avertissements de contenu</h2>
            <p>{{ view.game.contentWarnings }}</p>
          </section>
        }
        <section aria-labelledby="presentation">
          <!-- Les intertitres de la présentation (h3) viennent sous ce titre. -->
          <h2 id="presentation" class="visually-hidden">Présentation</h2>
          <!-- Le style du rendu est commun aux deux fronts : presentation.css, de @chimeres/design. -->
          <div class="presentation" [innerHTML]="view.presentation"></div>
        </section>
      } @else if (data.schedule()) {
        <p class="gone">Cette partie n'est plus au programme.</p>
        <div class="gone">
          <a routerLink="/programme" replaceUrl appButton="secondary">Voir le programme</a>
        </div>
      } @else {
        <p>Chargement…</p>
      }
    </main>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
      }

      .bar {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        gap: var(--space-xs);
        align-items: center;
        min-height: var(--bar-height);
        padding: var(--space-xs) var(--space-s);
        border-bottom: 1px solid var(--border);
        background: var(--surface-1);
      }

      main {
        display: grid;
        align-content: start;
        gap: var(--space-l);
        width: 100%;
        max-width: var(--content-width);
        margin-inline: auto;
        padding: var(--gutter);
      }

      app-scenario-illustration {
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
      }

      .heading {
        display: grid;
        gap: var(--space-s);
      }

      .over {
        color: var(--text-muted);
        font-family: var(--font-caps);
        font-size: var(--font-size-mobile-overline);
        font-weight: normal;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .meta {
        color: var(--text-muted);
      }

      .numbers {
        font-variant-numeric: tabular-nums;
      }

      .counter {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);
        align-items: center;
      }

      .warnings {
        display: grid;
        gap: var(--space-xs);
        padding: var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-2);
      }

      .gone {
        text-align: center;
      }
    }
  `,
})
export class GamePage {
  protected readonly data = inject(ParticipantData);
  protected readonly location = inject(Location);

  private readonly gameId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('gameId'))),
  );

  /** La partie et ses textes, ou `null` si elle n'est plus au programme. */
  protected readonly view = computed(() => {
    const schedule = this.data.schedule();
    const game = schedule?.games.find(({ id }) => id === this.gameId());
    if (!schedule || !game) return null;
    return {
      game,
      barLabel: `${ranksLabelOf(schedule, game)} · table ${game.tableName}`,
      slotLabel: timeSlotsLabelOf(schedule, game),
      counter: counterOf(game),
      presentation: renderPresentation(game.presentation),
    };
  });
}
