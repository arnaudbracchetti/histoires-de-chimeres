import { Component, input } from '@angular/core';
import { fr, NBSP } from '@chimeres/design';
import { Icon } from '../ui/icon';

/**
 * Ce que les notifications apportent (§4.2, NO-2), redit à chaque étape qui les concerne. Pas un
 * mot de « partie très demandée » : la liste dit ce qu'on attend, pas chaque cas.
 */
@Component({
  selector: 'app-notification-benefits',
  imports: [Icon],
  template: `
    <ul>
      <li>
        <app-icon name="circle-check" />
        <span><strong>Ta table</strong>, dès la publication du tirage de chaque créneau, ou les tables où il reste de la place</span>
      </li>
      <li>
        <app-icon name="sparkles" />
        <span><strong>Les nouvelles parties</strong> programmées pendant la journée</span>
      </li>
      <li>
        <app-icon name="triangle-alert" />
        <span><strong>Tes parties déplacées ou retirées</strong> du programme</span>
      </li>
      @if (gameMaster()) {
        <li>
          <app-icon name="book-open" />
          <span><strong>Les parties que tu mènes</strong>{{ gameMasterGames }}</span>
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
        text-align: start;
      }

      li {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
      }

      app-icon {
        color: var(--accent);
      }
    }
  `,
})
export class NotificationBenefits {
  readonly gameMaster = input(false);

  protected readonly gameMasterGames = fr` : programmées, déplacées, annulées`;
}

/** Un exemple de notification, présenté comme tel (§4.2). */
@Component({
  selector: 'app-notification-example',
  template: `
    <figure>
      <figcaption class="over">Exemple de notification</figcaption>
      <div class="notification">
        <svg class="emblem" aria-hidden="true" focusable="false">
          <use href="emblem.svg#emblem-small" />
        </svg>
        <div>
          <strong>{{ example().title }}</strong>
          <span>{{ example().body }}</span>
        </div>
      </div>
    </figure>
  `,
  styles: `
    @layer components {
      figure {
        display: grid;
        gap: var(--space-xs);
        margin: 0;
        text-align: start;
      }

      .notification {
        display: grid;
        grid-template-columns: 32px 1fr;
        gap: var(--space-s);
        padding: var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-3);
        font-size: var(--font-size-mobile-meta);
      }

      .emblem {
        width: 32px;
        height: 32px;
      }

      strong,
      span {
        display: block;
      }

      span {
        color: var(--text-muted);
      }
    }
  `,
})
export class NotificationExample {
  readonly gameMaster = input(false);

  protected example(): { title: string; body: string } {
    return this.gameMaster()
      ? { title: fr`Créneau 2 : tu mènes à la table Dragon`, body: fr`La Tour d'ébène, avec 5${NBSP}joueurs.` }
      : { title: fr`Créneau 1 : table Griffon`, body: 'Tu joues à Opération Nébuleuse, avec Brann.' };
  }
}
