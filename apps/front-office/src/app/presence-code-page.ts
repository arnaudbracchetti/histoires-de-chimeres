import { Component, inject, output, signal } from '@angular/core';
import { frontOfficeEndpoints } from '@chimeres/contract';
import { injectApiCall } from './api-call';
import { PresenceCodeStore } from './presence-code-store';
import { readProblem } from './problem';

/**
 * Écran « Code de présence » (ID-2) : le téléphone n'a pas reçu le code par le QR code (web app
 * de l'iPhone, lien sans code, avant le jour J). Un bon code est gardé.
 */
@Component({
  selector: 'app-presence-code-page',
  template: `
    <h1>Code de présence</h1>
    <p>Tape le code écrit en clair sous le QR code, sur l'affiche de l'accueil.</p>
    <form novalidate (submit)="$event.preventDefault(); enter()">
      <label for="presence-code">Code</label>
      <input
        id="presence-code"
        type="text"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        aria-describedby="presence-code-error"
        [attr.aria-invalid]="error() ? true : null"
        [value]="code()"
        (input)="code.set($any($event.target).value)"
      />
      <p class="error" id="presence-code-error">{{ error() }}</p>
      <button type="submit" [disabled]="submitting()">
        {{ submitting() ? 'Vérification…' : 'Entrer' }}
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

      label {
        font-weight: 600;
      }

      input {
        padding: var(--space-s);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-1);
        color: var(--text);
        font-family: var(--font-caps);
        font-size: var(--font-size-section);
        letter-spacing: 0.2em;
        text-align: center;
        text-transform: uppercase;

        &[aria-invalid='true'] {
          border-color: var(--danger);
        }
      }

      /* Ligne réservée, vide sans erreur : le bouton ne bouge pas. */
      .error {
        min-height: 1.4lh;
        color: var(--danger);
        font-size: var(--font-size-meta);
      }

      button {
        padding: var(--space-s) var(--space-m);
        border: none;
        border-radius: var(--radius-control);
        background: var(--accent);
        color: var(--on-accent);
      }
    }
  `,
})
export class PresenceCodePage {
  /** L'API dit que la convention est terminée. */
  readonly ended = output<void>();

  private readonly apiCall = injectApiCall();
  private readonly store = inject(PresenceCodeStore);

  protected readonly code = signal('');
  protected readonly error = signal('');
  protected readonly submitting = signal(false);

  protected async enter(): Promise<void> {
    const code = this.code();
    if (!code.trim()) {
      this.error.set('Tape le code de présence.');
      return;
    }
    this.submitting.set(true);
    try {
      await this.apiCall(frontOfficeEndpoints.verifyPresenceCode, { body: { presenceCode: code } });
      this.store.keep(code);
    } catch (error) {
      const problem = readProblem(error);
      if (problem.code === 'convention-ended') this.ended.emit();
      else this.error.set(problem.message);
    } finally {
      this.submitting.set(false);
    }
  }
}
