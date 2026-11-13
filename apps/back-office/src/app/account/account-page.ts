import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, validate } from '@angular/forms/signals';
import { fr } from '@chimeres/design';
import { PASSWORD_HELP, passwordRules } from '../forms/password-rules';
import { submitWith } from '../forms/submit-with';
import { Announcer } from '../shell/announcer';
import { PageHeader } from '../shell/page-header';
import { Field } from '../ui/field';
import { SaveButton } from '../ui/save-button';
import { AccountStore } from './account-store';

/** La saisie : le nouveau mot de passe, deux fois ; seule la première part à l'API. */
const EMPTY_MODEL = { currentPassword: '', password: '', passwordConfirmation: '' };

/**
 * Mon compte, ouvert par le pseudo en bas du rail : changer son mot de passe (ADR 0019). Le mot de
 * passe actuel est demandé, le nouveau saisi deux fois ; les autres sessions de la personne se ferment, celle-ci reste ouverte.
 * Après un oubli, c'est un lien d'accès, créé par un Organisateur, qui fait choisir un nouveau mot
 * de passe (ADR 0018).
 */
@Component({
  selector: 'app-account-page',
  imports: [Field, FormField, FormRoot, PageHeader, SaveButton],
  template: `
    <app-page-header title="Mon compte">
      @if (account(); as me) {
        <p appPageSubtitle class="nickname">{{ me.nickname }}</p>
      }
    </app-page-header>
    <section aria-labelledby="password-title">
      <h2 id="password-title">Mot de passe</h2>
      <form [formRoot]="form">
        <app-field label="Mot de passe actuel">
          <input
            type="password"
            autocomplete="current-password"
            [formField]="form.currentPassword"
          />
        </app-field>
        <app-field label="Nouveau mot de passe" [help]="passwordHelp">
          <input type="password" autocomplete="new-password" [formField]="form.password" />
        </app-field>
        <app-field label="Nouveau mot de passe, une seconde fois">
          <input
            type="password"
            autocomplete="new-password"
            [formField]="form.passwordConfirmation"
          />
        </app-field>
        <p class="help">{{ sessionsHelp }}</p>
        <app-save-button [submitting]="form().submitting()" [savedAt]="savedAt()" />
      </form>
    </section>
  `,
  styles: `
    @layer components {
      .nickname {
        color: var(--text-muted);
      }

      section {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        padding: var(--space-l) var(--space-xl);
      }

      h2 {
        font-size: var(--font-size-section);
      }

      form {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        align-items: flex-start;
        max-width: 32rem;
      }

      app-field {
        align-self: stretch;
      }

      input {
        width: 100%;
      }

      .help {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class AccountPage {
  protected readonly passwordHelp = PASSWORD_HELP;
  protected readonly sessionsHelp = fr`Tes autres sessions, sur d'autres ordinateurs, seront fermées.`;

  private readonly store = inject(AccountStore);
  private readonly announcer = inject(Announcer);
  protected readonly account = this.store.value;
  protected readonly savedAt = signal<number | undefined>(undefined);

  private readonly model = signal(EMPTY_MODEL);

  protected readonly form = form(
    this.model,
    (path) => {
      validate(path.currentPassword, ({ value }) =>
        value() ? undefined : { kind: 'required', message: fr`Indique ton mot de passe actuel.` },
      );
      passwordRules(path.password);
      validate(path.passwordConfirmation, ({ value, valueOf }) =>
        value() === valueOf(path.password)
          ? undefined
          : { kind: 'mismatch', message: fr`Les deux saisies du nouveau mot de passe diffèrent.` },
      );
    },
    { submission: submitWith(() => this.save()) },
  );

  /** Les champs se vident après le changement : rien ne reste à l'écran. */
  private async save(): Promise<void> {
    const { currentPassword, password } = this.model();
    await this.store.changePassword({ currentPassword, password });
    this.model.set(EMPTY_MODEL);
    this.form().reset();
    this.savedAt.set(Date.now());
    this.announcer.announce(fr`Mot de passe changé.`);
  }
}
