import { afterNextRender, Component, inject, Injector, output, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import {
  linkedPhoneEndpoints,
  NICKNAME_MAX_LENGTH,
  type IdentityConfirmationDto,
} from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { submitWith } from '../forms/submit-with';
import { textRules } from '../forms/text-rules';
import { LinkedPhone } from '../linked-phone';
import { PresenceCodeStore } from '../presence-code-store';
import { readProblem } from '../problem';
import { Alerts } from '../shell/alerts';
import { countOf, fr } from '../typography/french';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';

/**
 * S'identifier par un pseudo (ID-1) : l'écran « Ton pseudo », puis, pour un pseudo existant,
 * « Ce pseudo existe déjà », ou « Es-tu bien ce MJ ? » pour celui d'un MJ (ID-3). Chaque
 * étape a son propre retour, sans compter sur le geste de retour du téléphone. Le code de
 * présence gardé part avec le pseudo (ID-2).
 */
@Component({
  selector: 'app-nickname-page',
  imports: [Button, Field, FormField, FormRoot, Icon],
  template: `
    @if (existing(); as pending) {
      <button
        type="button"
        appButton="icon"
        class="back"
        aria-label="Retour"
        title="Retour"
        (click)="chooseAnother()"
      >
        <app-icon name="chevron-left" />
      </button>
      <p class="nickname">{{ pending.nickname }}</p>
      @if (pending.confirmation === 'game-master') {
        <h1>{{ gameMasterQuestion }}</h1>
        <p>{{ whatGameMasterLinkOpens }}</p>
        <p class="meta">{{ gameMasterInDoubt }}</p>
      } @else {
        <h1>Ce pseudo existe déjà</h1>
        <p>{{ question }}</p>
        <p>{{ whoCreatedIt }}</p>
        <p class="meta">{{ inDoubt }}</p>
      }
      <div class="actions">
        <button type="button" appButton="primary" (click)="confirm(pending.confirmation)">
          {{ confirming() ? 'Vérification…' : "Oui, c'est moi" }}
        </button>
        <button type="button" appButton="secondary" (click)="chooseAnother()">
          Non, choisir un autre pseudo
        </button>
      </div>
    } @else {
      <h1>Ton pseudo</h1>
      <p>{{ intro }}</p>
      <form [formRoot]="form">
        <app-field label="Pseudo">
          <input
            [formField]="form.nickname"
            type="text"
            autocomplete="off"
            autocapitalize="words"
            spellcheck="false"
            enterkeyhint="go"
          />
        </app-field>
        <button type="submit" appButton="primary">
          {{ form().submitting() ? 'Vérification…' : 'Continuer' }}
        </button>
      </form>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      /* En haut à gauche de l'écran, à portée du pouce, hors du contenu centré. */
      .back {
        position: fixed;
        top: var(--space-s);
        left: var(--space-s);
      }

      .nickname {
        color: var(--accent);
        font-family: var(--font-display);
        font-size: var(--font-size-mobile-hero);
        line-height: var(--line-height-display);
        overflow-wrap: anywhere;
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }

      form,
      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
      }

      form {
        gap: var(--space-xs);
      }
    }
  `,
})
export class NicknamePage {
  /** L'API dit que la convention est terminée. */
  readonly ended = output<void>();

  protected readonly intro = fr`C'est ton nom pour toute la convention : les MJ le voient à leur table. Si tu en as déjà saisi un pour la convention, retape le même pour retrouver tes inscriptions.`;
  protected readonly question = fr`Est-ce bien toi qui l'as créé ?`;
  protected readonly whoCreatedIt = fr`C'est toi si tu as déjà tapé ce pseudo plus tôt dans la journée, sur ce téléphone ou un autre. Tu retrouves alors tes inscriptions.`;
  protected readonly inDoubt = fr`Si quelqu'un d'autre l'a choisi, prends-en un autre : sinon, tu t'inscrirais à sa place. En cas de doute, demande à un Organisateur, à l'accueil : il retrouve les pseudos et leurs inscriptions.`;
  protected readonly gameMasterQuestion = fr`Es-tu bien ce MJ ?`;
  protected readonly whatGameMasterLinkOpens = fr`Ce pseudo est celui d'un MJ de la convention. Si c'est toi, ton téléphone te montre les parties que tu mènes, dans Mes parties, et reçoit leurs notifications.`;
  protected readonly gameMasterInDoubt = fr`Si ce n'est pas toi, choisis un autre pseudo. En cas de doute, demande à un Organisateur, à l'accueil.`;

  private readonly apiCall = injectApiCall();
  private readonly alerts = inject(Alerts);
  private readonly injector = inject(Injector);
  private readonly linkedPhone = inject(LinkedPhone);
  private readonly presenceCode = inject(PresenceCodeStore);

  private readonly model = signal({ nickname: '' });
  /** Le pseudo existant, tel qu'il s'affiche, et la confirmation qu'il attend. */
  protected readonly existing = signal<{
    nickname: string;
    confirmation: IdentityConfirmationDto;
  } | null>(null);
  protected readonly confirming = signal(false);

  protected readonly form = form(
    this.model,
    (path) =>
      textRules(path.nickname, NICKNAME_MAX_LENGTH, {
        required: 'Tape ton pseudo.',
        tooLong: fr`Ton pseudo fait ${countOf(NICKNAME_MAX_LENGTH, 'caractère', 'caractères')} au plus : raccourcis-le.`,
      }),
    { submission: submitWith(() => this.link(null)) },
  );

  /** « Oui, c'est moi » : relie le téléphone au pseudo existant. Un refus part en alerte. */
  protected async confirm(confirmation: IdentityConfirmationDto): Promise<void> {
    if (this.confirming()) return;
    this.confirming.set(true);
    try {
      await this.link(confirmation);
    } catch (error) {
      const { alert, fieldErrors } = readProblem(error);
      this.alerts.error(alert ?? { title: fieldErrors.map(({ message }) => message).join(' ') });
    } finally {
      this.confirming.set(false);
    }
  }

  /** « Non, choisir un autre pseudo », ou ‹ : revient au champ, avec le pseudo tapé. */
  protected chooseAnother(): void {
    this.existing.set(null);
    afterNextRender(() => this.form.nickname().focusBoundControl(), { injector: this.injector });
  }

  /**
   * S'identifier. Un code de présence refusé est oublié, pour que l'écran du code le redemande, et
   * son refus part en alerte ; les autres refus remontent tels quels.
   */
  private async link(confirmation: IdentityConfirmationDto | null): Promise<void> {
    const { nickname } = this.model();
    let result;
    try {
      result = await this.apiCall(linkedPhoneEndpoints.link, {
        body: { presenceCode: this.presenceCode.code() ?? '', nickname, confirmation },
      });
    } catch (error) {
      const { code, fieldErrors } = readProblem(error);
      if (code === 'convention-ended') return this.ended.emit();
      if (code !== 'presence-code-wrong') throw error;
      this.alerts.error({ title: fieldErrors.map(({ message }) => message).join(' ') });
      return this.presenceCode.forget();
    }
    if (result.status === 'confirmation-needed') {
      this.existing.set({ nickname: result.nickname, confirmation: result.confirmation });
    } else this.linkedPhone.linked(result.nickname);
  }
}
