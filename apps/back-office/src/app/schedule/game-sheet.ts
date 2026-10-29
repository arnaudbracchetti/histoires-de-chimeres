import { Component, computed, ElementRef, inject, input, output } from '@angular/core';
import type { GameDto, TableDto, TimeSlotDto } from '@chimeres/contract';
import { formatSeats } from '../scenarios/scenario-format';
import { timeSlotLabel, plural } from '@chimeres/design';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { ScenarioIllustration } from '../ui/scenario-illustration';

/**
 * La fiche d'une partie, dans un panneau latéral non modal à droite de la frise
 * (docs/design/patterns.md, Fiche de la partie). Échap ou ✕ la ferme. Elle ne fait aucune
 * écriture : le Calendrier déplace et déprogramme.
 */
@Component({
  selector: 'app-game-sheet',
  imports: [Button, Icon, ScenarioIllustration],
  template: `
    <aside id="game-sheet" aria-labelledby="game-sheet-title" (keydown.escape)="closed.emit()">
      <div class="head">
        <app-scenario-illustration
          format="thumb"
          [title]="game().scenario.title"
          [imageUrl]="game().scenario.imageUrl"
        />
        <h2 id="game-sheet-title" tabindex="-1">{{ game().scenario.title }}</h2>
        <button
          type="button"
          appButton="icon"
          aria-label="Fermer la fiche"
          title="Fermer la fiche"
          (click)="closed.emit()"
        >
          <app-icon name="x" />
        </button>
      </div>
      <dl>
        <dt>Jeu</dt>
        <dd>{{ game().scenario.system }}</dd>
        <dt>MJ</dt>
        <dd>{{ game().scenario.gameMaster.nickname }}</dd>
        <dt>{{ plural(slots().length, 'Créneau', 'Créneaux') }}</dt>
        @for (slot of slots(); track slot.id) {
          <dd>{{ slotLabel(slot) }}</dd>
        }
        <dt>Table</dt>
        <dd>{{ table()?.name }}</dd>
        <dt>Places</dt>
        <dd>{{ formatSeats(game().seats) }}</dd>
      </dl>
      <div class="actions">
        <button type="button" appButton="secondary" (click)="moveRequested.emit()">
          Déplacer vers…
        </button>
        <button type="button" appButton="quiet-danger" (click)="unscheduleRequested.emit()">
          Déprogrammer
        </button>
      </div>
    </aside>
  `,
  styles: `
    @layer components {
      :host {
        display: block;
      }

      aside {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        padding: var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);
      }

      .head {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
      }

      app-scenario-illustration {
        flex: none;
        width: 44px;
      }

      h2 {
        flex: 1;
        min-width: 0;
        font-family: var(--font-ui);
        font-size: var(--font-size-block);
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: var(--space-xs) var(--space-m);
      }

      dt {
        grid-column: 1;
        color: var(--text-muted);
      }

      dd {
        grid-column: 2;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);
        justify-content: space-between;
      }
    }
  `,
})
export class GameSheet {
  readonly game = input.required<GameDto>();
  /** Dans l'ordre de la journée. */
  readonly timeSlots = input.required<readonly TimeSlotDto[]>();
  readonly tables = input.required<readonly TableDto[]>();

  readonly closed = output<void>();
  readonly moveRequested = output<void>();
  readonly unscheduleRequested = output<void>();

  protected readonly formatSeats = formatSeats;
  protected readonly plural = plural;
  protected readonly slotLabel = timeSlotLabel;
  protected readonly slots = computed(() =>
    this.timeSlots().filter(({ id }) => this.game().timeSlotIds.includes(id)),
  );
  protected readonly table = computed(() =>
    this.tables().find(({ id }) => id === this.game().tableId),
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Met le focus sur le titre de la fiche, qui la nomme aux lecteurs d'écran. */
  focus(): void {
    this.host.querySelector<HTMLElement>('h2')?.focus();
  }
}
