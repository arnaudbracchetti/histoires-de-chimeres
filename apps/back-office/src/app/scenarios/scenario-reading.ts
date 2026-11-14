import { Component, computed, input } from '@angular/core';
import type { ScenarioDto } from '@chimeres/contract';
import { formatSeats } from '@chimeres/design';
import { renderPresentation } from '@chimeres/design/presentation';
import { formatScenarioDuration } from './scenario-format';

/**
 * Un scénario en lecture seule, pour le compte qui ne peut pas l'écrire (le scénario d'un autre
 * MJ) : son jeu, ses places, sa durée, ses avertissements et sa présentation rendue. Son image est
 * à côté, dans la page. Le HTML de la présentation passe par `[innerHTML]`, donc par le sanitizer d'Angular.
 */
@Component({
  selector: 'app-scenario-reading',
  host: { class: 'reading' },
  template: `
    <dl>
      <dt>Jeu</dt>
      <dd>{{ scenario().system }}</dd>
      <dt>Places</dt>
      <dd>{{ formatSeats(scenario().seats) }}</dd>
      <dt>Durée</dt>
      <dd>{{ formatScenarioDuration(scenario().duration) }}</dd>
      @if (scenario().contentWarnings.trim()) {
        <dt>Avertissements de contenu</dt>
        <dd>{{ scenario().contentWarnings }}</dd>
      }
    </dl>
    <!-- Le style du rendu est commun aux deux fronts : presentation.css, de @chimeres/design. -->
    <div class="presentation" [innerHTML]="html()"></div>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-l);
      }

      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: var(--space-xs) var(--space-l);
        margin: 0;
      }

      dt {
        color: var(--text-muted);
      }

      dd {
        margin: 0;
      }
    }
  `,
})
export class ScenarioReading {
  readonly scenario = input.required<ScenarioDto>();

  protected readonly html = computed(() => renderPresentation(this.scenario().presentation));
  protected readonly formatSeats = formatSeats;
  protected readonly formatScenarioDuration = formatScenarioDuration;
}
