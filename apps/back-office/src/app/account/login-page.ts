import { afterNextRender, Component, ElementRef, inject, Injector, signal } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { fr } from '@chimeres/design';
import { submitWith } from '../forms/submit-with';
import { readProblem } from '../problem';
import type { ErrorNotice } from '../shell/error-dialog';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { PasswordReveal } from '../ui/password-reveal';
import { AccountStore } from './account-store';

/**
 * Page de connexion au back office (ADR 0015) : le pseudo et le mot de passe, hors du rail.
 * Connecté, on arrive au calendrier. Un refus de l'API s'écrit dans la boîte, sous le bouton, à la
 * place de l'aide : une faute de frappe se corrige sans dialogue à fermer. Un pseudo inconnu et un
 * mauvais mot de passe y donnent le même message. Le pseudo est gardé, le mot de passe vidé, le
 * focus dessus. La boîte est ancrée en haut : elle ne grandit que vers le bas, rien ne bouge.
 */
@Component({
  selector: 'app-login-page',
  imports: [Button, Field, FormField, PasswordReveal],
  template: `
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
        <app-password-reveal>
          <input type="password" autocomplete="current-password" [formField]="form.password" />
        </app-password-reveal>
      </app-field>
      <button type="submit" appButton="primary">
        {{ form().submitting() ? 'Connexion…' : 'Se connecter' }}
      </button>
      <!-- Toujours là : le refus qui remplace l'aide est lu aux lecteurs d'écran. -->
      <div class="outcome" aria-live="assertive">
        @if (refusal(); as refusal) {
          <!-- Un paragraphe neuf à chaque refus : le même message, répété, est relu. -->
          @for (attempt of [refusal.attempt]; track attempt) {
            <p class="refusal">
              <strong>{{ refusal.title }}</strong>
              @if (refusal.detail) {
                {{ refusal.detail }}
              }
            </p>
          }
        } @else {
          <p class="help">{{ forgotten }}</p>
        }
      </div>
    </form>
  `,
  styles: `
    @layer components {
      /* Ancrée en haut : un refus allonge la boîte vers le bas, sans rien déplacer. */
      :host {
        display: grid;
        min-height: 100vh;
        place-items: start center;
        padding: max(var(--space-l), 15vh) var(--space-l) var(--space-l);
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

      .help,
      .refusal {
        margin: 0;
        font-size: var(--font-size-meta);
      }

      .help {
        color: var(--text-muted);
      }

      .refusal {
        color: var(--danger);

        strong {
          display: block;
        }
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

  /** Le dernier refus de l'API, écrit sous le bouton, numéroté par tentative. */
  protected readonly refusal = signal<(ErrorNotice & { attempt: number }) | undefined>(undefined);

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
   * Un refus, avec ou sans champ, s'écrit sous le bouton, et y reste jusqu'au suivant ; le mot de
   * passe est vidé, le focus dessus.
   */
  private async write(): Promise<void> {
    try {
      await this.store.logIn(this.model());
    } catch (error) {
      const { fieldErrors, notice } = readProblem(error);
      this.refusal.set({
        ...(notice ?? { title: fieldErrors.map(({ message }) => message).join(' ') }),
        attempt: (this.refusal()?.attempt ?? 0) + 1,
      });
      this.model.update((model) => ({ ...model, password: '' }));
      this.form.password().reset();
      afterNextRender(
        () => this.host.querySelector<HTMLElement>('app-password-reveal input')?.focus(),
        {
          injector: this.injector,
        },
      );
      return;
    }
    await this.router.navigateByUrl('/');
  }
}
