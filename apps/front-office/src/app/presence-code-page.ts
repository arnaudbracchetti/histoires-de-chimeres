import { Component, inject, output, signal } from '@angular/core';
import { form, FormField, FormRoot, validate } from '@angular/forms/signals';
import { frontOfficeEndpoints } from '@chimeres/contract';
import { injectApiCall } from './api-call';
import { submitWith } from './forms/submit-with';
import { PresenceCodeStore } from './presence-code-store';
import { readProblem } from './problem';
import { Button } from './ui/button';
import { Field } from './ui/field';

/**
 * Écran « Code de présence » (ID-2) : le téléphone n'a pas reçu le code par le QR code (web app
 * de l'iPhone, lien sans code, avant le jour J). Un bon code est gardé.
 */
@Component({
  selector: 'app-presence-code-page',
  imports: [Button, Field, FormField, FormRoot],
  template: `
    <h1>Code de présence</h1>
    <p>Tape le code écrit en clair sous le QR code, sur l'affiche de l'accueil.</p>
    <form [formRoot]="form">
      <app-field label="Code">
        <input
          [formField]="form.presenceCode"
          type="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          enterkeyhint="go"
        />
      </app-field>
      <button type="submit" appButton="primary">
        {{ form().submitting() ? 'Vérification…' : 'Entrer' }}
      </button>
    </form>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      form {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      input {
        font-family: var(--font-caps);
        font-size: var(--font-size-mobile-section);
        letter-spacing: 0.2em;
        text-align: center;
        text-transform: uppercase;
      }
    }
  `,
})
export class PresenceCodePage {
  /** L'API dit que la convention est terminée. */
  readonly ended = output<void>();

  private readonly apiCall = injectApiCall();
  private readonly store = inject(PresenceCodeStore);

  private readonly model = signal({ presenceCode: '' });

  protected readonly form = form(
    this.model,
    (path) =>
      validate(path.presenceCode, ({ value }) =>
        value().trim() ? undefined : { kind: 'required', message: 'Tape le code de présence.' },
      ),
    { submission: submitWith(() => this.enter()) },
  );

  private async enter(): Promise<void> {
    const { presenceCode } = this.model();
    try {
      await this.apiCall(frontOfficeEndpoints.verifyPresenceCode, { body: { presenceCode } });
    } catch (error) {
      if (readProblem(error).code !== 'convention-ended') throw error;
      this.ended.emit();
      return;
    }
    this.store.keep(presenceCode);
  }
}
