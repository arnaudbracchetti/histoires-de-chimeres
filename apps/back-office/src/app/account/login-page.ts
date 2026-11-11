import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { fr } from '@chimeres/design';
import { submitWith } from '../forms/submit-with';
import { readProblem } from '../problem';
import { ErrorDialog } from '../shell/error-dialog';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { AccountStore } from './account-store';

/**
 * Page de connexion au back office (ADR 0015) : le pseudo et le mot de passe, hors du rail.
 * Connecté, on arrive au calendrier. Un refus de l'API, avec ou sans champ, fait disparaître la
 * boîte de connexion et s'ouvre dans le dialogue d'erreur, comme toute erreur du back office : un
 * pseudo inconnu et un mauvais mot de passe y donnent le même message. Le dialogue fermé, la boîte
 * revient, le pseudo gardé et le mot de passe à ressaisir.
 */
@Component({
  selector: 'app-login-page',
  imports: [Button, Field, FormField],
  template: `
    @if (!failing()) {
      <form class="box" (submit)="$event.preventDefault(); logIn()">
        <div class="brand">
          <svg class="emblem" aria-hidden="true" focusable="false">
            <use href="emblem.svg#emblem-small" />
          </svg>
          <span>Histoires de Chimères</span>
        </div>
        <h1 tabindex="-1">Connexion</h1>
        <app-field label="Pseudo">
          <input type="text" autocomplete="username" [formField]="form.nickname" />
        </app-field>
        <app-field label="Mot de passe">
          <input type="password" autocomplete="current-password" [formField]="form.password" />
        </app-field>
        <button type="submit" appButton="primary">
          {{ form().submitting() ? 'Connexion…' : 'Se connecter' }}
        </button>
        <p class="help">{{ forgotten }}</p>
      </form>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: grid;
        min-height: 100vh;
        place-items: center;
        padding: var(--space-l);
      }

      .box {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        width: min(100%, 24rem);
        padding: var(--space-l);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-1);
      }

      .brand {
        display: flex;
        gap: var(--space-s);
        align-items: center;
        font-family: var(--font-display);
      }

      .emblem {
        width: 1.5rem;
        height: 1.5rem;
      }

      h1 {
        margin: 0 0 var(--space-s);
      }

      input {
        width: 100%;
      }

      button {
        align-self: flex-start;
      }

      .help {
        margin: 0;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class LoginPage {
  protected readonly forgotten = fr`Mot de passe oublié ? Demande un lien d'accès à un Organisateur.`;

  private readonly store = inject(AccountStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly errorDialog = inject(ErrorDialog);
  private readonly destroyRef = inject(DestroyRef);

  /** Le dialogue d'un refus est ouvert : la boîte de connexion s'efface. */
  protected readonly failing = signal(false);

  private readonly model = signal({ nickname: '', password: '' });

  protected readonly form = form(
    this.model,
    (path) => {
      validate(path.nickname, ({ value }) =>
        value().trim() ? undefined : { kind: 'required', message: fr`Indique ton pseudo.` },
      );
      validate(path.password, ({ value }) =>
        value() ? undefined : { kind: 'required', message: fr`Indique ton mot de passe.` },
      );
    },
    { submission: submitWith(() => this.write()) },
  );

  constructor() {
    afterNextRender(() => this.host.querySelector('input')?.focus());
  }

  protected logIn(): void {
    void submit(this.form);
  }

  /**
   * Un refus, avec ou sans champ, passe par le dialogue d'erreur ; à sa fermeture, la boîte revient,
   * le focus sur le mot de passe vidé.
   */
  private async write(): Promise<void> {
    try {
      await this.store.logIn(this.model());
    } catch (error) {
      const { fieldErrors, notice } = readProblem(error);
      this.failing.set(true);
      await this.errorDialog.open(
        notice ?? { title: fieldErrors.map(({ message }) => message).join(' ') },
      );
      // La page a pu partir pendant le dialogue : rien à rendre.
      if (this.destroyRef.destroyed) return;
      this.failing.set(false);
      this.model.update((model) => ({ ...model, password: '' }));
      this.form.password().reset();
      this.focusAfterRender('input[type=password]');
      return;
    }
    await this.router.navigateByUrl('/');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
