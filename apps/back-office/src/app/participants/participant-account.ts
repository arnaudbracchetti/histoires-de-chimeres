import { Component, computed, inject, input, output } from '@angular/core';
import {
  accessLinkEndpoints,
  participantEndpoints,
  type AccountRole,
  type ParticipantAccountDto,
  type ParticipantSheetDto,
} from '@chimeres/contract';
import { fr } from '@chimeres/design';
import { AccountStore } from '../account/account-store';
import { injectApiCall } from '../api-call';
import { injectGesture } from '../gesture';
import { Announcer } from '../shell/announcer';
import { Confirmation } from '../ui/confirmation';
import { Icon } from '../ui/icon';
import { Button } from '../ui/button';
import { AccessLinkDialog } from './access-link-dialog';
import { describeAccessState } from './access-state';
import { RoleCard } from './role-card';
import { roleWithdrawalConsequences } from './role-withdrawal-consequences';

const APPOINT = {
  organizer: participantEndpoints.appointOrganizer,
  'game-master': participantEndpoints.appointGameMaster,
} as const;

const WITHDRAW = {
  organizer: participantEndpoints.withdrawOrganizerRole,
  'game-master': participantEndpoints.withdrawGameMasterRole,
} as const;

const ROLE_LABEL: Record<AccountRole, string> = {
  organizer: "d'Organisateur",
  'game-master': 'MJ',
};

/**
 * Onglet « Compte » de la fiche d'un pseudo (ID-16, docs/design/patterns.md, Fiche d'un pseudo) :
 * les deux rôles en cartes à cocher, qui prennent la couleur du rôle une fois cochées. Donner un
 * premier rôle crée le compte ; retirer un rôle demande une confirmation, qui dit ce qui part avec
 * lui. Le rôle MJ se donne sans confirmation, le rôle d'Organisateur avec. Un Organisateur ne peut
 * pas se retirer lui-même le rôle d'Organisateur : sa carte est désactivée.
 */
@Component({
  selector: 'app-participant-account',
  imports: [Button, Icon, RoleCard],
  host: { '[attr.aria-busy]': 'gesture.running()' },
  template: `
    @if (banner(); as banner) {
      <div class="banner" [attr.data-access-state]="banner.state">
        <app-icon [name]="banner.icon" />
        <span class="text">
          <strong>{{ banner.label }}</strong>
          <span class="help">{{ banner.help }}</span>
        </span>
        <button type="button" appButton="secondary" (click)="createAccessLink()">
          {{ banner.action }}
        </button>
      </div>
    } @else {
      <p class="account none">
        Pas de compte&nbsp;: participant seulement. Donne-lui un rôle pour lui créer un compte.
      </p>
    }
    <fieldset>
      <legend>Rôles dans le back office</legend>
      <app-role-card
        role="game-master"
        [checked]="sheet().gameMaster"
        (pressed)="toggle($event, 'game-master')"
      />
      <app-role-card
        role="organizer"
        [checked]="sheet().organizer"
        [disabled]="isMe()"
        (pressed)="toggle($event, 'organizer')"
      >
        @if (isMe()) {
          Tu ne peux pas te retirer ce rôle&nbsp;: un autre Organisateur peut le faire.
        }
      </app-role-card>
    </fieldset>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        max-width: 36rem;
      }

      .account {
        margin: 0;

        &.none {
          color: var(--text-muted);
        }
      }

      .banner {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
        padding: var(--space-s) var(--space-m);
        border-left: 4px solid var(--access-state);
        border-radius: var(--radius-control);
        background: color-mix(in srgb, var(--access-state) 14%, var(--surface-2));

        > app-icon {
          margin-top: 0.2em;
          color: var(--access-state);
        }

        strong {
          color: var(--access-state);
        }

        button {
          margin-left: auto;
          flex: none;
        }
      }

      fieldset {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        margin: 0;
        padding: 0;
        border: 0;
      }

      legend {
        margin-bottom: var(--space-s);
        padding: 0;
        font-weight: 600;
      }

      .text {
        display: flex;
        flex-direction: column;
      }

      .help {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class ParticipantAccount {
  readonly sheet = input.required<ParticipantSheetDto>();
  /** La fiche relue après un rôle donné ou retiré. */
  readonly changed = output<ParticipantSheetDto>();
  /** Un refus : la fiche est peut-être périmée. */
  readonly refused = output<void>();
  /** Un lien d'accès créé : l'état du compte a changé, la fiche est à relire. */
  readonly accessLinkCreated = output<void>();

  private readonly account = inject(AccountStore);
  private readonly confirmation = inject(Confirmation);
  private readonly announcer = inject(Announcer);
  private readonly accessLinkDialog = inject(AccessLinkDialog);
  private readonly apiCall = injectApiCall();
  protected readonly gesture = injectGesture({ errorDialog: true });

  /** Le bandeau de l'état du compte, ou rien sans compte. */
  protected readonly banner = computed(() => {
    const account = this.sheet().account;
    return account && describeAccessState(account);
  });
  /** Le pseudo est celui de l'Organisateur connecté. */
  protected readonly isMe = computed(() => this.account.value()?.participantId === this.sheet().id);

  /**
   * Crée un lien d'accès (ADR 0018), puis le montre. Il remet le compte à zéro : sur un compte actif,
   * une confirmation rouge le dit ; sur un lien en attente, une confirmation orange dit que l'ancien
   * ne marchera plus.
   */
  protected async createAccessLink(): Promise<void> {
    const sheet = this.sheet();
    const account = sheet.account!;
    const call = () =>
      this.apiCall(accessLinkEndpoints.create, { params: { participantId: sheet.id } });
    const consequences = describeAccessLinkConsequences(sheet.nickname, account);
    let link: Awaited<ReturnType<typeof call>> | undefined;
    if (consequences.length) {
      await this.confirmation.ask({
        question: fr`Créer un nouveau lien d'accès pour « ${sheet.nickname} » ?`,
        consequences,
        confirmLabel: 'Créer le lien',
        tone: account.state === 'active' ? 'danger' : 'primary',
        action: async () => (link = await call()),
        onStale: () => this.refused.emit(),
      });
    } else {
      const outcome = await this.gesture.run(call);
      if (outcome.status === 'refused') this.refused.emit();
      if (outcome.status === 'done') link = outcome.value;
    }
    if (!link) return;
    this.accessLinkCreated.emit();
    await this.accessLinkDialog.show(link, sheet.nickname);
  }

  /** La case ne change qu'avec la fiche relue : le geste passe d'abord, confirmation comprise. */
  protected toggle(event: Event, role: AccountRole): void {
    event.preventDefault();
    const sheet = this.sheet();
    const held = role === 'game-master' ? sheet.gameMaster : sheet.organizer;
    void (held ? this.withdraw(sheet, role) : this.appoint(sheet, role));
  }

  private async appoint(sheet: ParticipantSheetDto, role: AccountRole): Promise<void> {
    const call = () => this.apiCall(APPOINT[role], { params: { participantId: sheet.id } });
    if (role === 'organizer') {
      const done = await this.confirmation.ask({
        question: fr`Faire de « ${sheet.nickname} » un Organisateur ?`,
        consequences: [fr`« ${sheet.nickname} » aura tous les droits du back office.`],
        confirmLabel: 'Rendre Organisateur',
        tone: 'primary',
        action: async () => this.changed.emit(await call()),
        onStale: () => this.refused.emit(),
      });
      if (done) this.announcer.announce(fr`« ${sheet.nickname} » est maintenant Organisateur.`);
      return;
    }
    const outcome = await this.gesture.run(call);
    if (outcome.status === 'refused') this.refused.emit();
    if (outcome.status !== 'done') return;
    this.changed.emit(outcome.value);
    this.announcer.announce(fr`« ${sheet.nickname} » est maintenant MJ.`);
  }

  private async withdraw(sheet: ParticipantSheetDto, role: AccountRole): Promise<void> {
    const done = await this.confirmation.ask({
      question: fr`Retirer le rôle ${ROLE_LABEL[role]} à « ${sheet.nickname} » ?`,
      consequences: roleWithdrawalConsequences(sheet, role),
      confirmLabel: fr`Retirer le rôle ${ROLE_LABEL[role]}`,
      action: async () =>
        this.changed.emit(
          await this.apiCall(WITHDRAW[role], { params: { participantId: sheet.id } }),
        ),
      onStale: () => this.refused.emit(),
    });
    if (done) this.announcer.announce(fr`Rôle ${ROLE_LABEL[role]} retiré à « ${sheet.nickname} ».`);
  }
}

/** Ce qu'un nouveau lien efface : le mot de passe et les sessions d'un compte actif, l'ancien lien. */
function describeAccessLinkConsequences(
  nickname: string,
  account: ParticipantAccountDto,
): string[] {
  if (account.state === 'active') {
    return [
      fr`Son mot de passe est effacé tout de suite, et ses sessions ouvertes sont fermées. « ${nickname} » en choisira un nouveau par le lien.`,
    ];
  }
  if (account.state === 'pending') return [fr`Le lien déjà créé ne marchera plus.`];
  return [];
}
