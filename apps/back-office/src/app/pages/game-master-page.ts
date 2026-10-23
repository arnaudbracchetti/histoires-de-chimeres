import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { gameMasterEndpoints, type GameMasterDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { apiResource } from '../api-resource';
import { ConventionStore } from '../convention/convention-store';
import { availabilitiesConsequence } from '../game-masters/availabilities-consequence';
import { AvailabilityTimeline } from '../game-masters/availability-timeline';
import { NicknameEditor } from '../game-masters/nickname-editor';
import { Announcer } from '../shell/announcer';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Confirmation } from '../ui/confirmation';
import { Icon } from '../ui/icon';
import { MoreMenu, type MoreMenuItem } from '../ui/more-menu';

const MENU: readonly MoreMenuItem[] = [{ value: 'remove', label: 'Supprimer le MJ', danger: true }];

/**
 * Fiche d'un MJ (docs/design/patterns.md, Coquille) : « MJ › pseudo ». Le pseudo se modifie dans
 * l'en-tête, la suppression passe par « ⋯ », et les disponibilités se déclarent sur la frise de la
 * journée. Elle ne lit que le MJ et les créneaux, rien de réservé aux Organisateurs : elle deviendra
 * l'espace du MJ lui-même.
 */
@Component({
  selector: 'app-game-master-page',
  imports: [AvailabilityTimeline, Button, Icon, Loadable, MoreMenu, NicknameEditor, PageHeader],
  template: `
    <app-page-header
      [title]="gameMaster()?.nickname ?? 'Fiche du MJ'"
      [trail]="[{ label: 'MJ', link: '/mj' }]"
      [titleHidden]="editing()"
    >
      <ng-container ngProjectAs="[appPageTitle]">
        @if (gameMaster(); as gameMaster) {
          @if (editing()) {
            <app-nickname-editor
              [gameMaster]="gameMaster"
              (saved)="onRenamed($event)"
              (cancelled)="closeEditor()"
            />
          } @else {
            <button
              type="button"
              appButton="icon"
              class="edit-nickname"
              aria-label="Modifier le pseudo"
              title="Modifier le pseudo"
              (click)="editing.set(true)"
            >
              <app-icon name="pencil" />
            </button>
          }
        }
      </ng-container>
      @if (gameMaster(); as gameMaster) {
        <app-more-menu
          label="Autres actions sur le MJ"
          [items]="menu"
          (selected)="onMenu($event, gameMaster)"
        />
      }
    </app-page-header>
    <app-loadable [resource]="resource" [failure]="failure()">
      @if (gameMaster(); as gameMaster) {
        <section aria-labelledby="availabilities-title">
          <h2 id="availabilities-title">Disponibilités</h2>
          @if (timeSlots().length) {
            <app-availability-timeline
              [gameMaster]="gameMaster"
              [timeSlots]="timeSlots()"
              (changed)="onAvailabilitiesChanged($event)"
              (refused)="reloadAfterRefusal()"
            />
          } @else {
            <p class="none">
              Aucun créneau pour l'instant : les disponibilités attendent la journée.
            </p>
          }
        </section>
      }
    </app-loadable>
  `,
  styles: `
    @layer components {
      app-loadable {
        padding: var(--space-l) var(--space-xl);
      }

      section {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      h2 {
        font-size: var(--font-size-section);
      }

      .none {
        color: var(--text-muted);
      }
    }
  `,
})
export class GameMasterPage {
  /** Identifiant du MJ, lu dans l'URL. */
  readonly id = input.required<string>();

  protected readonly resource = apiResource(gameMasterEndpoints.read, () => ({
    gameMasterId: this.id(),
  }));
  protected readonly gameMaster = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );
  protected readonly editing = signal(false);
  protected readonly menu = MENU;

  protected readonly failure = computed(() => {
    const error = this.resource.error();
    return error instanceof HttpErrorResponse && error.status === 404
      ? "Ce MJ n'existe pas, ou plus."
      : 'Impossible de charger le MJ.';
  });

  private readonly store = inject(ConventionStore);
  protected readonly timeSlots = this.store.timeSlots;

  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly confirmation = inject(Confirmation);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  protected onRenamed(gameMaster: GameMasterDto): void {
    this.resource.set(gameMaster);
    this.closeEditor();
  }

  /** Ferme le champ du pseudo ; le focus revient au crayon. */
  protected closeEditor(): void {
    this.editing.set(false);
    afterNextRender(() => this.host.querySelector<HTMLElement>('.edit-nickname')?.focus(), {
      injector: this.injector,
    });
  }

  /** Le nombre de disponibilités de chaque créneau a changé : la convention partagée est relue. */
  protected onAvailabilitiesChanged(gameMaster: GameMasterDto): void {
    this.resource.set(gameMaster);
    this.store.convention.reload();
  }

  /** Un geste refusé : le MJ ou un créneau a pu changer ailleurs, l'écran est relu. */
  protected reloadAfterRefusal(): void {
    this.resource.reload();
    this.store.convention.reload();
  }

  protected onMenu(value: string, gameMaster: GameMasterDto): void {
    if (value === 'remove') void this.remove(gameMaster);
  }

  private async remove({ id, nickname, availabilities }: GameMasterDto) {
    const removed = await this.confirmation.ask({
      question: `Supprimer le MJ « ${nickname} » ?`,
      consequence: availabilitiesConsequence(availabilities.length),
      confirmLabel: 'Supprimer le MJ',
      action: () => this.apiCall(gameMasterEndpoints.remove, { params: { gameMasterId: id } }),
    });
    if (!removed) return;
    this.announcer.announce(`MJ « ${nickname} » supprimé.`);
    if (availabilities.length) this.store.convention.reload();
    await this.router.navigate(['/mj']);
  }
}
