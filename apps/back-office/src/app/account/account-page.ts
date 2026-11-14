import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, validate } from '@angular/forms/signals';
import { fr } from '@chimeres/design';
import { PASSWORD_HELP, passwordRules } from '../forms/password-rules';
import { submitWith } from '../forms/submit-with';
import { Announcer } from '../shell/announcer';
import { PageHeader } from '../shell/page-header';
import { Field } from '../ui/field';
import { PasswordReveal } from '../ui/password-reveal';
import { SaveButton } from '../ui/save-button';
import { AccountStore } from './account-store';

const EMPTY_MODEL = { currentPassword: '', password: '' };

/**
 * Mon compte, ouvert par le pseudo en bas du rail : changer son mot de passe (ADR 0019). Le mot de
 * passe actuel est demandé, puis le nouveau, une seule fois : l'œil de chaque champ l'affiche en
 * clair pour le vérifier. Les autres sessions de la personne se ferment, celle-ci reste ouverte.
 * Après un oubli, c'est un lien d'accès, créé par un Organisateur, qui fait choisir un nouveau mot
 * de passe (ADR 0018).
 */
@Component({
  selector: 'app-account-page',
  imports: [Field, FormField, FormRoot, PageHeader, PasswordReveal, SaveButton],
  template: `
    <app-page-header title="Mon compte">
      @if (account(); as me) {
        <p appPageSubtitle class="nickname">{{ me.nickname }}</p>
      }
    </app-page-header>
    <section class="page-body" aria-labelledby="password-title">
      <h2 id="password-title">Mot de passe</h2>
      <form [formRoot]="form">
        <app-field label="Mot de passe actuel">
          <app-password-reveal>
            <input
              type="password"
              autocomplete="current-password"
              [formField]="form.currentPassword"
            />
          </app-password-reveal>
        </app-field>
        <app-field label="Nouveau mot de passe" [help]="passwordHelp">
          <app-password-reveal>
            <input type="password" autocomplete="new-password" [formField]="form.password" />
          </app-password-reveal>
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
    },
    { submission: submitWith(() => this.save()) },
  );

  /** Les champs se vident après le changement : rien ne reste à l'écran. */
  private async save(): Promise<void> {
    await this.store.changePassword(this.model());
    this.model.set(EMPTY_MODEL);
    this.form().reset();
    this.savedAt.set(Date.now());
    this.announcer.announce(fr`Mot de passe changé.`);
  }
}
