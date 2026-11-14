import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { accessLinkEndpoints } from '@chimeres/contract';
import { fr } from '@chimeres/design';
import { apiResource, currentValue } from '../api-resource';
import { PASSWORD_HELP, passwordRules } from '../forms/password-rules';
import { submitWith } from '../forms/submit-with';
import { readProblem } from '../problem';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { PasswordReveal } from '../ui/password-reveal';
import { AccountStore } from './account-store';

/**
 * La page d'un lien d'accès (ID-6, ADR 0018), hors du rail, comme la connexion : « Lune, choisis
 * ton mot de passe », puis le pseudo en champ en lecture seule, que le gestionnaire de mots de
 * passe du navigateur enregistre avec le mot de passe, saisi une fois, l'œil pour le vérifier. Ouvrir la page ne consomme pas le lien ; c'est l'envoi du
 * mot de passe qui l'utilise, puis la personne est connectée et arrive au calendrier. Un lien
 * inconnu, utilisé ou expiré est dit à la place du formulaire. L'API sert la page sans `Referer`.
 */
@Component({
  selector: 'app-access-link-page',
  imports: [Button, Field, FormField, FormRoot, PasswordReveal, RouterLink],
  template: `
    <div class="box">
      <div class="brand">
        <svg class="emblem" aria-hidden="true" focusable="false">
          <use href="emblem.svg#emblem-small" />
        </svg>
        <span>Histoires de Chimères</span>
      </div>
      @if (link(); as link) {
        <h1 tabindex="-1">{{ title() }}</h1>
        <p>{{ loginHint() }}</p>
        <form [formRoot]="form">
          <!-- Le pseudo dans le formulaire : le gestionnaire de mots de passe enregistre la paire. -->
          <div class="nickname">
            <label for="access-link-nickname">Pseudo</label>
            <input
              id="access-link-nickname"
              type="text"
              name="username"
              autocomplete="username"
              readonly
              [value]="link.nickname"
            />
          </div>
          <app-field label="Mot de passe" [help]="passwordHelp">
            <app-password-reveal>
              <input type="password" autocomplete="new-password" [formField]="form.password" />
            </app-password-reveal>
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
      .nickname,
      input {
        align-self: stretch;
      }

      /* Comme un app-field, ligne d'erreur réservée comprise : les champs restent alignés. */
      .nickname {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding-bottom: calc(var(--font-size-meta) * 1.4);

        label {
          font-weight: 600;
        }

        input {
          color: var(--text-muted);
          background: var(--surface-2);
        }
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
  protected readonly title = computed(() => fr`${this.link()?.nickname}, choisis ton mot de passe`);
  /** Le pseudo est répété : c'est lui qu'il faudra taper à la connexion. */
  protected readonly loginHint = computed(
    () =>
      fr`Tu te connecteras ensuite avec ton pseudo, ${this.link()?.nickname}, et ce mot de passe.`,
  );
  /** Le lien refusé par l'API : inconnu, déjà utilisé ou expiré. */
  protected readonly refusal = computed(() => {
    const error = this.resource.error();
    return error ? readProblem(error).notice : undefined;
  });

  private readonly model = signal({ password: '' });

  protected readonly form = form(this.model, (path) => passwordRules(path.password), {
    submission: submitWith(() => this.choose()),
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const injector = inject(Injector);
    // Le lien lu, le formulaire s'affiche ; le pseudo ne se saisit pas : le focus va au mot de passe.
    effect(() => {
      if (!this.link()) return;
      afterNextRender(() => host.querySelector<HTMLElement>('input[type=password]')?.focus(), {
        injector,
      });
    });
  }

  private async choose(): Promise<void> {
    await this.store.choosePasswordByAccessLink(this.token(), this.model().password);
    await this.router.navigateByUrl('/');
  }
}
