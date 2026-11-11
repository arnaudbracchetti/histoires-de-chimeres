import { Component, computed, inject, input, output } from '@angular/core';
import {
  participantEndpoints,
  type AccountRole,
  type ParticipantSheetDto,
} from '@chimeres/contract';
import { fr } from '@chimeres/design';
import { AccountStore } from '../account/account-store';
import { injectApiCall } from '../api-call';
import { injectGesture } from '../gesture';
import { Announcer } from '../shell/announcer';
import { Confirmation } from '../ui/confirmation';
import { Icon } from '../ui/icon';
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
  imports: [Icon],
  host: { '[attr.aria-busy]': 'gesture.running()' },
  template: `
    <p class="account" [class.none]="!hasAccount()">
      @if (hasAccount()) {
        Ce pseudo a un compte du back office.
      } @else {
        Pas de compte&nbsp;: participant seulement. Donne-lui un rôle pour lui créer un compte.
      }
    </p>
    <fieldset>
      <legend>Rôles dans le back office</legend>
      <label class="role" [class.on]="sheet().gameMaster" style="--role: var(--role-game-master)">
        <input
          type="checkbox"
          [checked]="sheet().gameMaster"
          (click)="toggle($event, 'game-master')"
        />
        <app-icon name="dices" />
        <span class="text">
          <strong>MJ</strong>
          <span class="help">Saisit ses scénarios et ses disponibilités.</span>
        </span>
      </label>
      <label class="role" [class.on]="sheet().organizer" style="--role: var(--role-organizer)">
        <input
          type="checkbox"
          [checked]="sheet().organizer"
          [disabled]="isMe()"
          (click)="toggle($event, 'organizer')"
        />
        <app-icon name="settings" />
        <span class="text">
          <strong>Organisateur</strong>
          <span class="help">
            Tous les droits du back office.
            @if (isMe()) {
              Tu ne peux pas te retirer ce rôle&nbsp;: un autre Organisateur peut le faire.
            }
          </span>
        </span>
      </label>
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

      .role {
        display: flex;
        gap: var(--space-s);
        align-items: center;
        padding: var(--space-s) var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        cursor: pointer;

        &:has(input:disabled) {
          cursor: default;
        }

        > app-icon {
          color: var(--text-muted);
        }

        &.on {
          border-color: color-mix(in srgb, var(--role) 45%, transparent);
          background: color-mix(in srgb, var(--role) 14%, var(--surface-2));

          > app-icon,
          strong {
            color: var(--role);
          }
        }
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

  private readonly account = inject(AccountStore);
  private readonly confirmation = inject(Confirmation);
  private readonly announcer = inject(Announcer);
  private readonly apiCall = injectApiCall();
  protected readonly gesture = injectGesture({ errorDialog: true });

  protected readonly hasAccount = computed(() => this.sheet().account !== null);
  /** Le pseudo est celui de l'Organisateur connecté. */
  protected readonly isMe = computed(() => this.account.value()?.participantId === this.sheet().id);

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
