import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, Injectable, signal } from '@angular/core';
import { fr } from '@chimeres/design';
import { QrCode } from '../poster/qr-code';
import { Announcer } from '../shell/announcer';
import { Button } from '../ui/button';
import { Confirmation, type Consequence } from '../ui/confirmation';
import { AccountsStore, formatDay, hasAccount, type Person } from './accounts-store';

/**
 * PROTOTYPE JETABLE (#169) : les gestes sur un compte, communs aux trois variantes, et le
 * dialogue qui montre le lien d'accès à remettre. Les règles simulées viennent des résolutions
 * de « Lien d'accès, mot de passe et session » (#165) et de l'ADR 0016.
 */
@Component({
  selector: 'app-proto-access-link-dialog',
  imports: [Button, QrCode],
  template: `
    <h2 id="proto-link-title">{{ data.title }}</h2>
    <p>
      Remettez ce lien à <strong>{{ person().nickname }}</strong>, de vive voix ou par message.
      Il ouvre la page où {{ person().nickname }} choisit son mot de passe.
    </p>
    <div class="link">
      <app-qr-code [url]="person().link!.url" label="QR code du lien d'accès" />
      <div class="side">
        <input type="text" readonly [value]="person().link!.url" (focus)="$any($event.target).select()" />
        <button type="button" appButton="secondary" (click)="copy()">
          {{ copied() ? 'Copié' : 'Copier le lien' }}
        </button>
        <p class="meta">
          Valable jusqu'au {{ day() }}, une seule fois. Créer un autre lien annule celui-ci.
        </p>
      </div>
    </div>
    <div class="actions">
      <button type="button" appButton="quiet" class="proto" (click)="simulate()">
        [proto] La personne a choisi son mot de passe
      </button>
      <button type="button" appButton="primary" (click)="ref.close()">Fermer</button>
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        width: 36rem;
        padding: var(--space-l);
        border-radius: var(--radius-card);
        background: var(--surface-2);
      }

      h2,
      p {
        margin: 0;
      }

      .link {
        display: flex;
        gap: var(--space-m);
        align-items: flex-start;
      }

      app-qr-code {
        width: 9rem;
        flex: none;
      }

      .side {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        align-items: flex-start;
        min-width: 0;
        flex: 1;
      }

      input {
        width: 100%;
        font-family: monospace;
        font-size: var(--font-size-meta);
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .actions {
        display: flex;
        justify-content: space-between;
      }

      .proto {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class AccessLinkDialog {
  protected readonly data = inject<{ id: string; title: string }>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  private readonly store = inject(AccountsStore);
  protected readonly person = computed(() => this.store.byId(this.data.id)!);
  protected readonly day = computed(() => formatDay(this.person().link!.expiresAt));
  protected readonly copied = signal(false);

  protected copy(): void {
    void navigator.clipboard?.writeText(this.person().link!.url);
    this.copied.set(true);
  }

  protected simulate(): void {
    this.store.simulatePasswordChosen(this.data.id);
    this.ref.close();
  }
}

@Injectable({ providedIn: 'root' })
export class AccountGestures {
  private readonly store = inject(AccountsStore);
  private readonly confirmation = inject(Confirmation);
  private readonly dialog = inject(Dialog);
  private readonly announcer = inject(Announcer);

  /** Montre le lien d'accès en cours. */
  showLink(person: Person, title = 'Lien d’accès'): void {
    this.dialog.open(AccessLinkDialog, {
      data: { id: person.id, title },
      ariaLabelledBy: 'proto-link-title',
      restoreFocus: true,
    });
  }

  /** Crée un lien d'accès ; si la personne a déjà un mot de passe, une confirmation d'abord. */
  async createLink(person: Person): Promise<void> {
    if (person.passwordChosen || person.link) {
      const consequences: Consequence[] = [];
      if (person.passwordChosen)
        consequences.push(
          fr`Son mot de passe est effacé tout de suite, et ses sessions ouvertes sont fermées. ${person.nickname} en choisira un nouveau par le lien.`,
        );
      if (person.link) consequences.push('Le lien déjà créé ne marchera plus.');
      const done = await this.confirmation.ask({
        question: fr`Créer un nouveau lien d'accès pour « ${person.nickname} » ?`,
        consequences,
        confirmLabel: 'Créer le lien',
        tone: person.passwordChosen ? 'danger' : 'primary',
        action: async () => this.store.createLink(person.id),
      });
      if (!done) return;
    } else {
      this.store.createLink(person.id);
    }
    this.showLink(this.store.byId(person.id)!, 'Lien d’accès créé');
  }

  /** Donne ou retire le rôle MJ, avec les conséquences. Résout `true` si le rôle a changé. */
  async setGameMaster(person: Person, gameMaster: boolean): Promise<boolean> {
    if (gameMaster) {
      this.store.setRoles(person.id, { gameMaster: true });
      this.announcer.announce(fr`« ${person.nickname} » est maintenant MJ.`);
      if (!person.organizer) await this.offerLink(person);
      return true;
    }
    const consequences: Consequence[] = [];
    if (person.scenarios)
      consequences.push(fr`Ses ${person.scenarios} scénarios et ses disponibilités seront supprimés.`);
    else consequences.push('Ses disponibilités seront supprimées.');
    if (person.games)
      consequences.push({
        text: fr`« ${person.nickname} » mène ${person.games} parties : à trancher dans « Gestion des comptes » (refus, ou parties sans MJ).`,
        level: 'warning',
      });
    if (!person.organizer)
      consequences.push(
        fr`Sans autre rôle, ${person.nickname} perd son compte : son pseudo reste, comme participant, avec ses inscriptions et ses téléphones.`,
      );
    return this.confirmation.ask({
      question: fr`Retirer le rôle MJ à « ${person.nickname} » ?`,
      consequences,
      confirmLabel: 'Retirer le rôle MJ',
      action: async () => this.store.setRoles(person.id, { gameMaster: false }),
    });
  }

  /** Donne ou retire le rôle Organisateur. Un Organisateur ne se le retire pas lui-même (ADR 0016). */
  async setOrganizer(person: Person, organizer: boolean): Promise<boolean> {
    if (organizer) {
      const done = await this.confirmation.ask({
        question: fr`Faire de « ${person.nickname} » un Organisateur ?`,
        consequences: [fr`« ${person.nickname} » aura tous les droits du back office, comme vous.`],
        confirmLabel: 'Rendre Organisateur',
        tone: 'primary',
        action: async () => this.store.setRoles(person.id, { organizer: true }),
      });
      if (done && !person.gameMaster) await this.offerLink(person);
      return done;
    }
    if (person.me) {
      await this.confirmation.ask({
        question: 'Vous ne pouvez pas vous retirer le rôle d’Organisateur',
        consequences: ['Un autre Organisateur peut le faire. Il reste ainsi toujours au moins un Organisateur.'],
        confirmLabel: 'Compris',
        cancelLabel: 'Fermer',
        tone: 'primary',
        action: async () => undefined,
      });
      return false;
    }
    const consequences: Consequence[] = person.gameMaster
      ? [fr`${person.nickname} reste MJ : son compte ne donne plus accès qu'à sa fiche et aux scénarios de la convention.`]
      : [fr`Sans autre rôle, ${person.nickname} perd son compte : son pseudo reste, comme participant.`];
    return this.confirmation.ask({
      question: fr`Retirer le rôle d'Organisateur à « ${person.nickname} » ?`,
      consequences,
      confirmLabel: 'Retirer le rôle',
      action: async () => this.store.setRoles(person.id, { organizer: false }),
    });
  }

  /** Un participant sans compte qui reçoit un rôle : son lien d'accès, tout de suite. */
  private async offerLink(before: Person): Promise<void> {
    if (hasAccount(before)) return;
    this.showLink(this.store.createLink(before.id), 'Compte créé : lien d’accès');
  }
}
