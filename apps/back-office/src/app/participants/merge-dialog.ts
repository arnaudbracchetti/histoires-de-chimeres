import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  participantEndpoints,
  type ParticipantListEntryDto,
  type ParticipantSheetDto,
} from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { apiQueryResource, apiResource } from '../api-resource';
import { injectGesture } from '../gesture';
import { Loadable } from '../shell/loadable';
import { Button } from '../ui/button';
import { TableFilter } from '../ui/table-filter';
import { mergeConsequences } from './merge-consequences';

/** Le délai entre la dernière frappe et la recherche : une requête par mot, pas par lettre. */
const SEARCH_DELAY_MS = 250;

type DialogData = { source: ParticipantSheetDto; titleId: string };

let nextId = 0;

/**
 * Dialogue de « Fusionner dans un autre pseudo… » (ID-11, docs/design/patterns.md, Fiche d'un
 * pseudo) : la recherche de la destination, que l'API fait, parmi les participants et les MJ, sauf
 * la source ; le choix par bouton radio ; puis ce que la fusion fera, créneau par créneau, lu dans
 * le verdict de l'API, et « Fusionner dans « Lune » » en rouge. Un refus s'affiche dans le dialogue.
 * Le dialogue se ferme sur la fiche de la destination, relue après la fusion.
 */
@Component({
  selector: 'app-merge-dialog',
  imports: [Button, Loadable, TableFilter],
  host: { class: 'placement-dialog', '[attr.aria-busy]': 'gesture.running()' },
  template: `
    <h2 [id]="data.titleId">
      Fusionner «&nbsp;{{ data.source.nickname }}&nbsp;» dans un autre pseudo
    </h2>
    <app-table-filter
      label="Chercher la destination"
      [value]="typed()"
      (valueChange)="delaySearch($event)"
    />
    <fieldset>
      <legend class="visually-hidden">Destination</legend>
      <ul class="choices">
        @for (candidate of candidates(); track candidate.id) {
          <li>
            <label>
              <input
                type="radio"
                name="destination"
                [checked]="destination()?.id === candidate.id"
                (change)="destination.set(candidate)"
              />
              {{ candidate.nickname }}
              @if (candidate.gameMaster) {
                <span class="role">MJ</span>
              }
            </label>
          </li>
        } @empty {
          @if (list.hasValue()) {
            <li class="quiet">Aucun pseudo ne correspond.</li>
          }
        }
      </ul>
    </fieldset>
    @if (destination()) {
      <app-loadable [resource]="verdict" failure="Impossible de lire ce que la fusion fera.">
        <div class="consequences">
          @for (consequence of consequences(); track $index) {
            <p>{{ consequence }}</p>
          }
        </div>
      </app-loadable>
    }
    <!-- Ligne réservée : un refus ne décale rien. -->
    <p role="alert" class="refusal">{{ refusal() }}</p>
    <div class="actions">
      <button type="button" appButton="quiet" class="cancel" (click)="ref.close()">
        {{ refusal() ? 'Fermer' : 'Annuler' }}
      </button>
      @if (destination(); as destination) {
        @if (!refusal()) {
          <button
            type="button"
            appButton="danger"
            [disabled]="!verdict.hasValue()"
            (click)="merge(destination)"
          >
            Fusionner dans «&nbsp;{{ destination.nickname }}&nbsp;»
          </button>
        }
      }
    </div>
  `,
  styles: `
    @layer components {
      :host {
        width: 34rem;
      }

      .actions {
        gap: var(--space-s);
      }

      fieldset {
        margin: 0;
        padding: 0;
        border: 0;
      }

      .choices {
        max-height: 12rem;
        overflow: auto;
        margin: 0;
        padding: 0;
        list-style: none;

        label {
          display: flex;
          gap: var(--space-s);
          align-items: center;
          padding-block: var(--space-xxs);
        }
      }

      .role,
      .quiet {
        color: var(--text-muted);
      }

      .consequences p {
        margin: 0 0 var(--space-xs);
      }
    }
  `,
})
export class MergeDialog {
  protected readonly data = inject<DialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ParticipantSheetDto>>(DialogRef);
  private readonly apiCall = injectApiCall();

  /** Le texte du champ, tel que tapé. */
  protected readonly typed = signal('');
  /** La recherche envoyée à l'API, après le délai. */
  private readonly search = signal('');
  protected readonly list = apiQueryResource(participantEndpoints.list, () => ({
    search: this.search(),
  }));
  /** Les pseudos trouvés, participants et MJ, sauf la source, dans l'ordre de l'API. */
  protected readonly candidates = computed(() =>
    (this.list.hasValue() ? (this.list.value() ?? []) : []).filter(
      ({ id }) => id !== this.data.source.id,
    ),
  );

  protected readonly destination = signal<ParticipantListEntryDto | undefined>(undefined);
  protected readonly verdict = apiResource(participantEndpoints.readMergeVerdict, () => {
    const destination = this.destination();
    return destination && { participantId: this.data.source.id, destinationId: destination.id };
  });
  protected readonly consequences = computed(() => {
    const destination = this.destination();
    const verdict = this.verdict.hasValue() ? this.verdict.value() : undefined;
    if (!destination || !verdict) return [];
    return mergeConsequences(verdict, {
      source: this.data.source.nickname,
      destination: destination.nickname,
      phones: this.data.source.linkedPhones.length,
    });
  });

  protected readonly gesture = injectGesture();
  protected readonly refusal = computed(() => this.gesture.refusal()?.message);

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected delaySearch(text: string): void {
    this.typed.set(text);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search.set(text), SEARCH_DELAY_MS);
  }

  /** Fusionne la source dans la destination ; le dialogue se ferme sur la fiche de la destination. */
  protected async merge(destination: ParticipantListEntryDto): Promise<void> {
    const outcome = await this.gesture.run(() =>
      this.apiCall(participantEndpoints.merge, {
        params: { participantId: this.data.source.id, destinationId: destination.id },
      }),
    );
    if (outcome.status === 'done') this.ref.close(outcome.value);
    else if (outcome.status === 'refused' && outcome.refusal.stale) this.verdict.reload();
  }
}

/** Ouvre le dialogue. À sa fermeture, le focus revient à l'élément qui l'a ouvert. */
@Injectable({ providedIn: 'root' })
export class ParticipantMerge {
  private readonly dialog = inject(Dialog);

  /** Résout la fiche de la destination après la fusion, ou `undefined` si le dialogue se ferme sans elle. */
  mergeIntoAnotherParticipant(
    source: ParticipantSheetDto,
  ): Promise<ParticipantSheetDto | undefined> {
    const titleId = `merge-${nextId++}`;
    const ref = this.dialog.open<ParticipantSheetDto, unknown, MergeDialog>(MergeDialog, {
      data: { source, titleId },
      ariaLabelledBy: titleId,
      autoFocus: 'input',
      restoreFocus: true,
    });
    return firstValueFrom(ref.closed);
  }
}
