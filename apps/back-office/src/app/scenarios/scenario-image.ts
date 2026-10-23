import { Component, inject, input, output, signal } from '@angular/core';
import { scenarioEndpoints, type ScenarioDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { injectApiUpload } from '../api-upload';
import { readProblem } from '../problem';
import { Announcer } from '../shell/announcer';
import { Button } from '../ui/button';
import { Confirmation } from '../ui/confirmation';
import { ScenarioIllustration } from '../ui/scenario-illustration';

/**
 * Zone image d'un scénario déjà créé (docs/design/patterns.md, Image d'un scénario) : hors de
 * « Enregistrer », l'image part dès qu'elle est choisie ou déposée, avec une barre de progression.
 * L'aperçu 3:2 est celui que renvoie l'API. Une image refusée l'est sous la zone, à une place
 * réservée qui ne décale rien. `changed` transmet le scénario relu après un envoi ou un retrait.
 */
@Component({
  selector: 'app-scenario-image',
  imports: [Button, ScenarioIllustration],
  template: `
    <div
      class="zone"
      [class.dropping]="dropping()"
      [attr.aria-busy]="progress() !== null"
      (dragover)="onDragOver($event)"
      (dragleave)="dropping.set(false)"
      (drop)="onDrop($event)"
    >
      <app-scenario-illustration format="card" [title]="title()" [imageUrl]="imageUrl()" />
      <div class="side">
        <p class="hint">
          JPEG, PNG, WebP ou AVIF, 10&nbsp;Mo au plus. L'image est recadrée en 3:2 au centre.
        </p>
        @if (progress() !== null) {
          <progress max="1" [value]="progress()" aria-label="Envoi de l'image"></progress>
        }
        <div class="actions">
          <button type="button" appButton="secondary" (click)="picker.click()">
            {{ imageUrl() ? 'Remplacer' : 'Choisir une image' }}
          </button>
          @if (imageUrl()) {
            <button type="button" appButton="quiet-danger" (click)="remove()">
              Retirer l'image
            </button>
          }
        </div>
      </div>
      <input
        #picker
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp,image/avif"
        (change)="onPicked(picker)"
      />
    </div>
    <p class="error" role="alert">{{ error() }}</p>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        /* Même largeur que les champs du formulaire : les bords droits s'alignent. */
        max-width: 44rem;
      }

      .zone {
        display: flex;
        gap: var(--space-l);
        align-items: center;
        padding: var(--space-m);
        border: 1px dashed var(--border);
        border-radius: var(--radius-card);

        &.dropping {
          border-color: var(--accent);
          background: var(--surface-2);
        }
      }

      app-scenario-illustration {
        flex: none;
        width: 22.5rem;
        border-radius: var(--radius-control);
      }

      .side {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
      }

      .hint {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      progress {
        width: 100%;
        height: 4px;
        accent-color: var(--accent);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);
      }

      /* Place réservée de deux lignes : une erreur ne décale rien. */
      .error {
        min-height: 2lh;
        color: var(--danger);
      }
    }
  `,
})
export class ScenarioImage {
  readonly scenarioId = input.required<string>();
  readonly title = input.required<string>();
  readonly imageUrl = input.required<string | null>();
  readonly changed = output<ScenarioDto>();

  /** De 0 à 1 pendant un envoi, `null` sinon. */
  protected readonly progress = signal<number | null>(null);
  protected readonly dropping = signal(false);
  protected readonly error = signal('');

  private readonly apiCall = injectApiCall();
  private readonly apiUpload = injectApiUpload();
  private readonly announcer = inject(Announcer);
  private readonly confirmation = inject(Confirmation);

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dropping.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dropping.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) void this.send(file);
  }

  protected onPicked(picker: HTMLInputElement): void {
    const file = picker.files?.[0];
    // Vidé, pour qu'un même fichier choisi de nouveau reparte.
    picker.value = '';
    if (file) void this.send(file);
  }

  private async send(file: File): Promise<void> {
    if (this.progress() !== null) return;
    this.error.set('');
    this.progress.set(0);
    try {
      const scenario = await this.apiUpload(scenarioEndpoints.changeImage, {
        params: { scenarioId: this.scenarioId() },
        file,
        field: 'image',
        progress: (fraction) => this.progress.set(fraction),
      });
      this.changed.emit(scenario);
      this.announcer.announce('Image enregistrée.');
    } catch (error) {
      const { alert, fieldErrors } = readProblem(error);
      this.error.set(
        alert ? (alert.detail ?? alert.title) : fieldErrors.map(({ message }) => message).join(' '),
      );
    } finally {
      this.progress.set(null);
    }
  }

  protected async remove(): Promise<void> {
    let scenario: ScenarioDto | undefined;
    const removed = await this.confirmation.ask({
      question: `Retirer l'image du scénario « ${this.title()} » ?`,
      consequence: "L'illustration par défaut la remplacera.",
      confirmLabel: "Retirer l'image",
      action: async () => {
        scenario = await this.apiCall(scenarioEndpoints.removeImage, {
          params: { scenarioId: this.scenarioId() },
        });
      },
    });
    if (!removed || !scenario) return;
    this.error.set('');
    this.changed.emit(scenario);
    this.announcer.announce('Image retirée.');
  }
}
