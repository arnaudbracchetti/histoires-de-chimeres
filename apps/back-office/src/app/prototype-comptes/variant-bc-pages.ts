import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { MoreMenu, type MoreMenuItem } from '../ui/more-menu';
import { QrCode } from '../poster/qr-code';
import { AccountGestures } from './account-gestures';
import { AccessStatus, RoleBadges } from './account-badges';
import {
  ACCESS_STATES,
  accessLabel,
  accessState,
  AccountsStore,
  type AccessState,
  formatDay,
  hasAccount,
  rolesLabel,
  type Person,
} from './accounts-store';

/**
 * PROTOTYPE JETABLE (#169) — Variantes B et C, sur une copie simplifiée de « Participants » et
 * de la fiche du pseudo (les vraies pages ne sont pas touchées : rien n'est écrit).
 *
 * B : pas de page à part. « Créer un pseudo » choisit aussi le rôle (aucun, MJ, Organisateur,
 *     les deux) ; la fiche a un 4e onglet « Compte » : deux interrupteurs de rôle et le lien.
 * C : « Nouveau compte » dans l'en-tête ouvre un dialogue en trois temps (pseudo → rôles → lien
 *     à remettre). Sur la fiche, les rôles et le lien passent par le menu « ⋯ », l'état du compte
 *     s'affiche sous le titre.
 */
type RoleChoice = 'none' | 'game-master' | 'organizer' | 'both';

@Component({
  selector: 'app-proto-pseudos-page',
  imports: [AccessStatus, Button, FormsModule, PageHeader, RoleBadges, RouterLink],
  template: `
    <app-page-header title="Participants">
      @if (store.variant() === 'C') {
        <button type="button" appButton="primary" (click)="openWizard()">Nouveau compte</button>
      }
      @if (store.variant() === 'D') {
        <button type="button" appButton="primary" (click)="openWizard()">Créer un pseudo</button>
      }
    </app-page-header>
    <div class="body">
      <div class="states" role="group" aria-label="Filtrer par état du compte">
        <button type="button" class="state scope" (click)="toggleAccountsOnly()">
          @if (accountsOnly()) {
            Tous les participants <span class="count">{{ store.people().length }}</span>
          } @else {
            Tous les participants avec un compte <span class="count">{{ countIn('accounts') }}</span>
          }
        </button>
        <span class="separator" aria-hidden="true"></span>
        @for (choice of stateFilters; track choice.key) {
          <button
            type="button"
            class="state"
            [style.--state]="choice.color"
            [attr.aria-pressed]="stateFilter() === choice.key"
            (click)="stateFilter.set(stateFilter() === choice.key ? 'all' : choice.key)"
          >
            {{ choice.label }} <span class="count">{{ countIn(choice.key) }}</span>
          </button>
        }
      </div>
      <input
        type="search"
        placeholder="Filtrer les pseudos"
        aria-label="Filtrer les pseudos"
        [(ngModel)]="search"
      />
      <table>
        <caption class="visually-hidden">Pseudos de la convention</caption>
        <thead>
          <tr>
            <th scope="col">Pseudo</th>
            <th scope="col">Rôle</th>
            <th scope="col">Accès au back office</th>
          </tr>
        </thead>
        <tbody>
          @for (person of rows(); track person.id) {
            <tr>
              <th scope="row">
                <a [routerLink]="['/prototype-comptes/pseudos', person.id]">{{ person.nickname }}</a>
              </th>
              <td><app-proto-role-badges [person]="person" /></td>
              <td><app-proto-access-status [person]="person" /></td>
            </tr>
          }
          @if (adding()) {
            <tr class="new">
              <td>
                <input
                  type="text"
                  placeholder="Nouveau pseudo"
                  aria-label="Pseudo"
                  [(ngModel)]="nickname"
                  (keydown.enter)="create()"
                  (keydown.escape)="adding.set(false)"
                />
              </td>
              <td>
                <select aria-label="Rôle" [(ngModel)]="role">
                  <option value="none">Participant</option>
                  <option value="game-master">MJ</option>
                  <option value="organizer">Organisateur</option>
                  <option value="both">MJ et Organisateur</option>
                </select>
              </td>
              <td class="new-actions">
                <button type="button" appButton="primary" (click)="create()">Créer</button>
                <button type="button" appButton="quiet" (click)="adding.set(false)">Annuler</button>
                @if (refusal()) {
                  <p class="refusal">{{ refusal() }}</p>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!adding() && store.variant() === 'B') {
        <button type="button" appButton="secondary" (click)="openNew()">Créer un pseudo</button>
      }
    </div>
  `,
  styles: `
    @layer components {
      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        align-items: flex-start;
        padding: var(--space-l) var(--space-xl);
      }

      table {
        width: 52rem;
      }

      .states {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }

      .state {
        padding: 0.2em 0.8em;
        border: 1px solid color-mix(in srgb, var(--state, var(--text-muted)) 50%, transparent);
        border-left: 4px solid var(--state, var(--text-muted));
        border-radius: var(--radius-control);
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: var(--font-size-meta);
        cursor: pointer;

        &[aria-pressed='true'] {
          background: color-mix(in srgb, var(--state, var(--text-muted)) 20%, transparent);
          font-weight: 600;
        }

        .count {
          color: var(--text-muted);
        }
      }

      .scope {
        border-left-width: 1px;
      }

      .separator {
        width: 1px;
        margin-inline: var(--space-xs);
        background: var(--border);
      }

      tbody th a {
        color: var(--text);
        font-weight: 600;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }

      .muted {
        color: var(--text-muted);
      }

      .new td {
        vertical-align: top;
      }

      .new-actions {
        white-space: nowrap;
      }

      .refusal {
        margin: var(--space-xs) 0 0;
        color: var(--danger, #a33);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class ProtoPseudosPage {
  protected readonly store = inject(AccountsStore);
  private readonly gestures = inject(AccountGestures);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  protected readonly rolesLabel = rolesLabel;
  protected readonly accessLabel = accessLabel;

  protected search = '';
  /** Bascule : tous les participants, ou seulement ceux qui ont un compte. */
  protected readonly accountsOnly = signal(false);

  protected toggleAccountsOnly(): void {
    this.accountsOnly.update((only) => !only);
    this.stateFilter.set('all');
  }

  protected readonly stateFilters: { key: AccessState | 'all' | 'accounts'; label: string; color?: string }[] = [
    ...(['active', 'pending', 'no-link', 'expired'] as const).map((key) => ({
      key,
      label: ACCESS_STATES[key].label,
      color: ACCESS_STATES[key].color,
    })),
  ];
  protected readonly stateFilter = signal<AccessState | 'all' | 'accounts'>('all');

  protected countIn(key: AccessState | 'all' | 'accounts'): number {
    return this.store.people().filter((person) => this.inState(person, key)).length;
  }

  private inState(person: Person, key: AccessState | 'all' | 'accounts'): boolean {
    if (key === 'all') return true;
    if (key === 'accounts') return hasAccount(person);
    return accessState(person) === key;
  }

  protected readonly adding = signal(false);
  protected nickname = '';
  protected role: RoleChoice = 'none';
  protected readonly refusal = signal('');

  protected rows(): Person[] {
    const wanted = this.search.trim().toLowerCase();
    return this.store
      .people()
      .filter((person) => person.nickname.toLowerCase().includes(wanted))
      .filter((person) => !this.accountsOnly() || hasAccount(person))
      .filter((person) => this.inState(person, this.stateFilter()))
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'fr'));
  }

  protected openNew(): void {
    this.nickname = '';
    this.role = 'none';
    this.refusal.set('');
    this.adding.set(true);
  }

  /** B : un seul geste crée le pseudo, son MJ, son compte et son lien d'accès. */
  protected create(): void {
    if (!this.nickname.trim()) return this.refusal.set('Saisissez un pseudo.');
    if (this.store.namesake(this.nickname))
      return this.refusal.set('Ce pseudo existe déjà : donnez-lui un rôle depuis sa fiche.');
    this.adding.set(false);
    if (this.role === 'none') {
      const person = this.store.createAccount(this.nickname, { gameMaster: false, organizer: false });
      this.store.setRoles(person.id, {});
      void this.router.navigate(['/prototype-comptes/pseudos', person.id]);
      return;
    }
    const person = this.store.createAccount(this.nickname, {
      gameMaster: this.role === 'game-master' || this.role === 'both',
      organizer: this.role === 'organizer' || this.role === 'both',
    });
    void this.router.navigate(['/prototype-comptes/pseudos', person.id], {
      queryParams: { onglet: 'compte' },
    });
    this.gestures.showLink(person, `Compte de « ${person.nickname} » créé`);
  }

  protected openWizard(): void {
    this.dialog.open(NewAccountWizard, { ariaLabelledBy: 'proto-wizard-title', restoreFocus: true });
  }
}

/** C : le dialogue « Nouveau compte », en trois temps. */
@Component({
  selector: 'app-proto-new-account-wizard',
  imports: [Button, FormsModule, QrCode],
  template: `
    <p class="steps">
      @for (label of steps; track $index) {
        <span [class.current]="step() === $index">{{ $index + 1 }}. {{ label }}</span>
      }
    </p>
    @switch (step()) {
      @case (0) {
        <h2 id="proto-wizard-title">{{ mixed ? 'Nouveau pseudo' : 'Nouveau compte' }}</h2>
        <label>
          Pseudo
          <input type="text" autocomplete="off" [(ngModel)]="nickname" (keydown.enter)="next()" />
        </label>
        @if (namesake(); as person) {
          <p class="hint">
            @if (hasAccount(person)) {
              « {{ person.nickname }} » a déjà un compte ({{ rolesLabel(person) }}) : changez ses
              rôles depuis sa fiche.
            } @else {
              « {{ person.nickname }} » existe déjà comme participant : le compte s'ajoutera à son
              pseudo, avec ses inscriptions et ses téléphones.
            }
          </p>
        }
      }
      @case (1) {
        <h2 id="proto-wizard-title">Rôles de « {{ nickname.trim() }} »</h2>
        <label class="choice">
          <input type="checkbox" [(ngModel)]="gameMaster" />
          <span><strong>MJ</strong><br />Saisit ses scénarios et ses disponibilités.</span>
        </label>
        <label class="choice">
          <input type="checkbox" [(ngModel)]="organizer" />
          <span><strong>Organisateur</strong><br />Tous les droits du back office.</span>
        </label>
        @if (mixed) {
          <p class="hint">
            Sans rôle, « {{ nickname.trim() }} » est un simple participant, sans accès au back
            office. Un rôle se donne aussi plus tard, dans l'onglet « Compte » de sa fiche.
          </p>
        }
      }
      @case (2) {
        <h2 id="proto-wizard-title">Lien d'accès de « {{ created()!.nickname }} »</h2>
        <p>Remettez-lui ce lien : il ouvre la page où choisir son mot de passe.</p>
        <div class="link">
          <app-qr-code [url]="created()!.link!.url" label="QR code du lien d'accès" />
          <div>
            <input type="text" readonly [value]="created()!.link!.url" />
            <button type="button" appButton="secondary" (click)="copy()">
              {{ copied() ? 'Copié' : 'Copier le lien' }}
            </button>
            <p class="hint">Valable jusqu'au {{ day() }}, une seule fois.</p>
          </div>
        </div>
      }
    }
    @if (refusal()) {
      <p class="refusal">{{ refusal() }}</p>
    }
    <div class="actions">
      @if (step() < 2) {
        <button type="button" appButton="quiet" (click)="ref.close()">Annuler</button>
        @if (step() === 1) {
          <button type="button" appButton="quiet" (click)="step.set(0)">Retour</button>
        }
        <button type="button" appButton="primary" (click)="next()">
          {{ step() === 0 ? 'Suivant' : !mixed ? 'Créer le compte' : gameMaster || organizer ? 'Créer le pseudo et son compte' : 'Créer le pseudo' }}
        </button>
      } @else {
        <button type="button" appButton="secondary" (click)="openSheet()">Voir sa fiche</button>
        <button type="button" appButton="primary" (click)="ref.close()">Terminé</button>
      }
    </div>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        width: 34rem;
        padding: var(--space-l);
        border-radius: var(--radius-card);
        background: var(--surface-2);
      }

      h2,
      p {
        margin: 0;
      }

      .steps {
        display: flex;
        gap: var(--space-m);
        color: var(--text-muted);
        font-size: var(--font-size-meta);

        .current {
          color: var(--text);
          font-weight: 600;
        }
      }

      label {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .choice {
        flex-direction: row;
        align-items: flex-start;
        padding: var(--space-s);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
      }

      .link {
        display: flex;
        gap: var(--space-m);

        app-qr-code {
          width: 8rem;
          flex: none;
        }

        div {
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
      }

      .hint {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .refusal {
        color: var(--danger, #a33);
      }

      .actions {
        display: flex;
        gap: var(--space-s);
        justify-content: flex-end;
      }
    }
  `,
})
export class NewAccountWizard {
  protected readonly ref = inject(DialogRef);
  private readonly store = inject(AccountsStore);
  private readonly router = inject(Router);
  protected readonly hasAccount = hasAccount;
  protected readonly rolesLabel = rolesLabel;
  /** D : l'assistant crée tout pseudo ; les rôles sont facultatifs, sans rôle pas de lien. */
  protected readonly mixed = this.store.variant() === 'D';
  protected readonly steps = this.mixed
    ? ['Pseudo', 'Rôles (facultatif)', 'Lien d’accès']
    : ['Pseudo', 'Rôles', 'Lien d’accès'];
  protected readonly step = signal(0);
  protected readonly refusal = signal('');
  protected readonly copied = signal(false);
  protected nickname = '';
  protected gameMaster = this.store.variant() !== 'D';
  protected organizer = false;
  private readonly createdId = signal<string | null>(null);
  protected readonly created = computed(() => {
    const id = this.createdId();
    return id ? this.store.byId(id) : undefined;
  });
  protected readonly day = computed(() => formatDay(this.created()!.link!.expiresAt));

  protected namesake(): Person | undefined {
    return this.store.namesake(this.nickname);
  }

  protected next(): void {
    this.refusal.set('');
    if (this.step() === 0) {
      if (!this.nickname.trim()) return this.refusal.set('Saisissez un pseudo.');
      const namesake = this.namesake();
      if (namesake && hasAccount(namesake)) return this.refusal.set('Ce pseudo a déjà un compte.');
      if (namesake && this.mixed)
        return this.refusal.set('Ce pseudo existe déjà : donnez-lui un rôle dans l’onglet « Compte » de sa fiche.');
      this.step.set(1);
      return;
    }
    if (!this.gameMaster && !this.organizer) {
      if (!this.mixed) return this.refusal.set('Choisissez au moins un rôle.');
      const person = this.store.createAccount(this.nickname, { gameMaster: false, organizer: false });
      this.store.setRoles(person.id, {});
      void this.router.navigate(['/prototype-comptes/pseudos', person.id]);
      this.ref.close();
      return;
    }
    const person = this.store.createAccount(this.nickname, {
      gameMaster: this.gameMaster,
      organizer: this.organizer,
    });
    this.createdId.set(person.id);
    this.step.set(2);
  }

  protected copy(): void {
    void navigator.clipboard?.writeText(this.created()!.link!.url);
    this.copied.set(true);
  }

  protected openSheet(): void {
    void this.router.navigate(['/prototype-comptes/pseudos', this.createdId()], {
      queryParams: this.mixed ? { onglet: 'compte' } : {},
    });
    this.ref.close();
  }
}

/** La fiche du pseudo, simplifiée : seuls l'en-tête et l'onglet « Compte » (B) sont prototypés. */
@Component({
  selector: 'app-proto-pseudo-sheet-page',
  imports: [
    AccessStatus,
    Button,
    Icon,
    MoreMenu,
    PageHeader,
    RoleBadges,
    Tab,
    TabContent,
    TabList,
    TabPanel,
    Tabs,
  ],
  template: `
    @if (person(); as person) {
      <app-page-header
        [title]="person.nickname"
        [trail]="[{ label: 'Participants', link: '/prototype-comptes/pseudos' }]"
      >
        <p appPageSubtitle class="subtitle">
          <app-proto-role-badges [person]="person" />
          <app-proto-access-status [person]="person" />
        </p>
        @if (store.variant() === 'C') {
          <app-more-menu label="Autres actions sur le pseudo" [items]="menu()" (selected)="onMenu($event)" />
        }
      </app-page-header>
      <div class="body">
        <div ngTabs class="binder">
          <div ngTabList aria-label="Vues du pseudo" [(selectedTab)]="tab">
            <button ngTab type="button" value="program"><app-icon name="calendar" />Programme</button>
            <button ngTab type="button" value="sign-ups"><app-icon name="circle-check" />Inscriptions</button>
            <button ngTab type="button" value="phones"><app-icon name="smartphone" />Téléphones</button>
            @if (withAccountTab()) {
              <button ngTab type="button" value="account">
                <app-icon name="lock" />Compte
                @if (stateColor(person); as color) {
                  <span class="dot" [style.background]="color" aria-hidden="true"></span>
                }
              </button>
            }
          </div>
          <div ngTabPanel value="program" class="panel">
            <ng-template ngTabContent><p class="muted">(Programme : inchangé, hors prototype.)</p></ng-template>
          </div>
          <div ngTabPanel value="sign-ups" class="panel">
            <ng-template ngTabContent><p class="muted">(Inscriptions : inchangé.)</p></ng-template>
          </div>
          <div ngTabPanel value="phones" class="panel">
            <ng-template ngTabContent><p class="muted">(Téléphones : inchangé.)</p></ng-template>
          </div>
          @if (withAccountTab()) {
            <div ngTabPanel value="account" class="panel">
              <ng-template ngTabContent>
                <section class="account">
                  @if (hasAccount(person)) {
                    <app-proto-access-status [person]="person" [banner]="true" />
                    <div class="access-actions">
                      @switch (accessState(person)) {
                        @case ('pending') {
                          <button type="button" appButton="secondary" (click)="gestures.showLink(person)">
                            Voir le lien d'accès
                          </button>
                          <button type="button" appButton="quiet" (click)="gestures.createLink(person)">
                            Créer un nouveau lien
                          </button>
                        }
                        @case ('expired') {
                          <button type="button" appButton="primary" (click)="gestures.createLink(person)">
                            Créer un nouveau lien d'accès
                          </button>
                        }
                        @case ('no-link') {
                          <button type="button" appButton="primary" (click)="gestures.createLink(person)">
                            Créer le lien d'accès
                          </button>
                        }
                        @case ('active') {
                          @if (!person.me) {
                            <button type="button" appButton="quiet" (click)="gestures.createLink(person)">
                              Mot de passe oublié : créer un nouveau lien
                            </button>
                          }
                        }
                      }
                    </div>
                  } @else {
                    <div class="no-account">
                      <app-icon name="user-round" />
                      <span>
                        <strong>Pas de compte</strong><br />
                        Participant seulement. Donnez-lui un rôle pour créer son compte et son lien
                        d'accès.
                      </span>
                    </div>
                  }
                  <h2>Rôles dans le back office</h2>
                  <label class="role-choice" [class.on]="person.gameMaster" style="--role: #b69cff">
                    <input
                      type="checkbox"
                      role="switch"
                      [checked]="person.gameMaster"
                      (click)="toggleGameMaster($event, person)"
                    />
                    <app-icon name="dices" />
                    <span>
                      <strong>MJ</strong>
                      <span class="muted">
                        Saisit ses scénarios et ses disponibilités.
                        @if (person.gameMaster) {
                          {{ person.scenarios }} scénario(s).
                        }
                      </span>
                    </span>
                  </label>
                  <label class="role-choice" [class.on]="person.organizer" style="--role: #4fd1c5">
                    <input
                      type="checkbox"
                      role="switch"
                      [checked]="person.organizer"
                      [disabled]="person.me"
                      (click)="toggleOrganizer($event, person)"
                    />
                    <app-icon name="settings" />
                    <span>
                      <strong>Organisateur</strong>
                      <span class="muted">
                        Tous les droits du back office.
                        @if (person.me) {
                          Vous ne pouvez pas vous retirer ce rôle.
                        }
                      </span>
                    </span>
                  </label>
                </section>
              </ng-template>
            </div>
          }
        </div>
      </div>
    } @else {
      <p class="body muted">Chargement…</p>
    }
  `,
  styles: `
    @layer components {
      .subtitle {
        margin: var(--space-xs) 0 0;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .body {
        padding: var(--space-l) var(--space-xl);
      }

      .binder {
        max-width: 48rem;
      }

      .muted {
        color: var(--text-muted);
      }

      .small {
        font-size: var(--font-size-meta);
      }

      .account {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        align-items: flex-start;

        h2 {
          margin: var(--space-s) 0 0;
          font-size: var(--font-size-body, 1rem);
        }

        p {
          margin: 0;
        }
      }

      .subtitle {
        display: flex;
        gap: var(--space-s);
        align-items: center;
      }

      .dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
      }

      .account {
        max-width: 36rem;
      }

      .account app-proto-access-status {
        align-self: stretch;
      }

      .access-actions {
        display: flex;
        gap: var(--space-s);
      }

      .no-account {
        display: flex;
        gap: var(--space-s);
        align-self: stretch;
        padding: var(--space-s) var(--space-m);
        border-left: 4px solid var(--text-muted);
        border-radius: var(--radius-control);
        background: var(--surface-3, var(--surface-1));
        color: var(--text-muted);

        strong {
          color: var(--text);
        }
      }

      .role-choice {
        display: flex;
        gap: var(--space-s);
        align-items: flex-start;
        align-self: stretch;
        padding: var(--space-s) var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        cursor: pointer;

        > app-icon {
          margin-top: 0.2em;
          color: var(--text-muted);
        }

        > span {
          display: flex;
          flex-direction: column;
        }

        &.on {
          border-color: color-mix(in srgb, var(--role) 55%, transparent);
          background: color-mix(in srgb, var(--role) 12%, transparent);

          > app-icon,
          strong {
            color: var(--role);
          }
        }
      }
    }
  `,
})
export class ProtoPseudoSheetPage {
  readonly id = input.required<string>();
  readonly onglet = input<string>();
  protected readonly store = inject(AccountsStore);
  protected readonly gestures = inject(AccountGestures);
  protected readonly rolesLabel = rolesLabel;
  protected readonly accessLabel = accessLabel;
  protected readonly hasAccount = hasAccount;
  protected readonly accessState = accessState;
  protected readonly person = computed(() => this.store.byId(this.id()));

  protected stateColor(person: Person): string | undefined {
    const state = accessState(person);
    return state === 'none' ? undefined : ACCESS_STATES[state].color;
  }
  protected tab = 'program';
  protected readonly withAccountTab = computed(() => ['B', 'D'].includes(this.store.variant()));

  ngOnInit(): void {
    if (this.onglet() === 'compte' && this.withAccountTab()) this.tab = 'account';
  }

  /** C : les gestes du compte passent par le menu « ⋯ ». */
  protected readonly menu = computed<MoreMenuItem[]>(() => {
    const person = this.person();
    if (!person) return [];
    const items: MoreMenuItem[] = [];
    if (hasAccount(person) && !person.me)
      items.push(
        person.link
          ? { value: 'show-link', label: 'Voir le lien d’accès' }
          : { value: 'link', label: person.passwordChosen ? 'Créer un nouveau lien d’accès…' : 'Créer le lien d’accès' },
      );
    items.push(
      person.gameMaster
        ? { value: 'game-master-off', label: 'Retirer le rôle MJ…', danger: true }
        : { value: 'game-master-on', label: 'Rendre MJ' },
    );
    if (!person.organizer) items.push({ value: 'organizer-on', label: 'Rendre Organisateur…' });
    else if (!person.me)
      items.push({ value: 'organizer-off', label: 'Retirer le rôle d’Organisateur…', danger: true });
    return items;
  });

  protected onMenu(value: string): void {
    const person = this.person()!;
    if (value === 'show-link') this.gestures.showLink(person);
    if (value === 'link') void this.gestures.createLink(person);
    if (value === 'game-master-on') void this.gestures.setGameMaster(person, true);
    if (value === 'game-master-off') void this.gestures.setGameMaster(person, false);
    if (value === 'organizer-on') void this.gestures.setOrganizer(person, true);
    if (value === 'organizer-off') void this.gestures.setOrganizer(person, false);
  }

  protected async toggleGameMaster(event: Event, person: Person): Promise<void> {
    event.preventDefault();
    await this.gestures.setGameMaster(person, !person.gameMaster);
  }

  protected async toggleOrganizer(event: Event, person: Person): Promise<void> {
    event.preventDefault();
    await this.gestures.setOrganizer(person, !person.organizer);
  }
}
