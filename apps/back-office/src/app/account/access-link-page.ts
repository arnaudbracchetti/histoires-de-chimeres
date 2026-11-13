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
import { form, FormField, FormRoot, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { accessLinkEndpoints } from '@chimeres/contract';
import { fr } from '@chimeres/design';
import { apiResource, currentValue } from '../api-resource';
import { PASSWORD_HELP, passwordRules } from '../forms/password-rules';
import { submitWith } from '../forms/submit-with';
import { readProblem } from '../problem';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { AccountStore } from './account-store';

/**
 * La page d'un lien d'accès (ID-6, ADR 0018), hors du rail, comme la connexion : « Choisis ton mot
 * de passe », avec le pseudo du compte. Ouvrir la page ne consomme pas le lien ; c'est l'envoi du
 * mot de passe qui l'utilise, puis la personne est connectée et arrive au calendrier. Un lien
 * inconnu, utilisé ou expiré est dit à la place du formulaire. L'API sert la page sans `Referer`.
 */
@Component({
  selector: 'app-access-link-page',
  imports: [Button, Field, FormField, FormRoot, RouterLink],
  template: `
    <div class="box">
      <div class="brand">
        <svg class="emblem" aria-hidden="true" focusable="false">
          <use href="emblem.svg#emblem-small" />
        </svg>
        <span>Histoires de Chimères</span>
      </div>
      @if (link(); as link) {
        <h1 tabindex="-1">Choisis ton mot de passe</h1>
        <p>
          Pour le compte de <strong>{{ link.nickname }}</strong
          >. Tu te connecteras ensuite par ton pseudo et ce mot de passe.
        </p>
        <form [formRoot]="form">
          <app-field label="Mot de passe" [help]="passwordHelp">
            <input type="password" autocomplete="new-password" [formField]="form.password" />
          </app-field>
          <app-field label="Mot de passe, une seconde fois">
            <input
              type="password"
              autocomplete="new-password"
              [formField]="form.passwordConfirmation"
            />
          </app-field>
          <button type="submit" appButton="primary">
            {{ form().submitting() ? 'Enregistrement…' : 'Choisir ce mot de passe' }}
          </button>
        </form>
      } @else if (refusal(); as refusal) {
        <h1 tabindex="-1">{{ refusal.title }}</h1>
        @if (refusal.detail) {
          <p class="refusal">{{ refusal.detail }}</p>
        }
        <a routerLink="/connexion">Aller à la connexion</a>
      }
    </div>
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
        width: min(100%, 28rem);
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

      h1,
      p {
        margin: 0;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        align-items: flex-start;
      }

      app-field,
      input {
        align-self: stretch;
      }

      .refusal {
        color: var(--danger);
      }
    }
  `,
})
export class AccessLinkPage {
  /** Le jeton du lien, lu dans le chemin. */
  readonly token = input.required<string>();

  protected readonly passwordHelp = PASSWORD_HELP;

  private readonly store = inject(AccountStore);
  private readonly router = inject(Router);

  private readonly resource = apiResource(accessLinkEndpoints.read, () => ({
    token: this.token(),
  }));
  protected readonly link = currentValue(this.resource);
  /** Le lien refusé par l'API : inconnu, déjà utilisé ou expiré. */
  protected readonly refusal = computed(() => {
    const error = this.resource.error();
    return error ? readProblem(error).notice : undefined;
  });

  private readonly model = signal({ password: '', passwordConfirmation: '' });

  protected readonly form = form(
    this.model,
    (path) => {
      passwordRules(path.password);
      validate(path.passwordConfirmation, ({ value, valueOf }) =>
        value() === valueOf(path.password)
          ? undefined
          : { kind: 'mismatch', message: fr`Les deux saisies du mot de passe diffèrent.` },
      );
    },
    { submission: submitWith(() => this.choose()) },
  );

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const injector = inject(Injector);
    afterNextRender(() => host.querySelector('input')?.focus(), { injector });
  }

  private async choose(): Promise<void> {
    await this.store.choosePasswordByAccessLink(this.token(), this.model().password);
    await this.router.navigateByUrl('/');
  }
}
