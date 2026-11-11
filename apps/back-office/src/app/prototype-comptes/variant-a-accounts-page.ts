import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { AccountGestures } from './account-gestures';
import { AccessStatus } from './account-badges';
import { accessState, AccountsStore, hasAccount, type Person } from './accounts-store';

/**
 * PROTOTYPE JETABLE (#169) — Variante A : une page « Comptes » dans le rail. Un tableau des
 * comptes, les deux rôles en cases à cocher dans la ligne, l'état du mot de passe et le lien
 * d'accès dans la ligne. « Créer un compte » ouvre une ligne : pseudo + cases MJ / Organisateur,
 * puis le lien d'accès s'affiche aussitôt. Un pseudo existant reçoit le compte (ID-7).
 */
@Component({
  selector: 'app-proto-accounts-page',
  imports: [AccessStatus, Button, FormsModule, PageHeader],
  template: `
    <app-page-header title="Comptes">
      <p appPageSubtitle class="subtitle">Qui entre dans le back office, et avec quel rôle.</p>
    </app-page-header>
    <div class="body">
      <div class="filters" role="group" aria-label="Filtrer les comptes">
        @for (choice of filters; track choice.key) {
          <button
            type="button"
            [appButton]="filter() === choice.key ? 'secondary' : 'quiet'"
            [attr.aria-pressed]="filter() === choice.key"
            (click)="filter.set(choice.key)"
          >
            {{ choice.label }} <span class="count">{{ count(choice.key) }}</span>
          </button>
        }
      </div>
      <table>
        <caption class="visually-hidden">Comptes du back office</caption>
        <thead>
          <tr>
            <th scope="col">Pseudo</th>
            <th scope="col" class="role">MJ</th>
            <th scope="col" class="role">Organisateur</th>
            <th scope="col">Accès</th>
            <th scope="col"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (person of rows(); track person.id) {
            <tr>
              <th scope="row">
                {{ person.nickname }}
                @if (person.me) {
                  <span class="muted">(vous)</span>
                }
              </th>
              <td class="role">
                <input
                  type="checkbox"
                  [checked]="person.gameMaster"
                  [attr.aria-label]="'MJ : ' + person.nickname"
                  (click)="toggleGameMaster($event, person)"
                />
              </td>
              <td class="role">
                <input
                  type="checkbox"
                  [checked]="person.organizer"
                  [attr.aria-label]="'Organisateur : ' + person.nickname"
                  [title]="person.me ? 'Vous ne pouvez pas vous retirer ce rôle' : ''"
                  (click)="toggleOrganizer($event, person)"
                />
              </td>
              <td class="access">
                <app-proto-access-status [person]="person" />
              </td>
              <td class="actions">
                @if (person.link && !isExpired(person)) {
                  <button type="button" appButton="quiet" (click)="gestures.showLink(person)">
                    Voir le lien
                  </button>
                } @else if (!person.me) {
                  <button type="button" appButton="quiet" (click)="gestures.createLink(person)">
                    {{ person.passwordChosen ? 'Nouveau lien' : 'Créer le lien' }}
                  </button>
                }
              </td>
            </tr>
          }
          @if (adding()) {
            <tr class="new">
              <td>
                <input
                  type="text"
                  placeholder="Pseudo"
                  aria-label="Pseudo du nouveau compte"
                  autocomplete="off"
                  [(ngModel)]="nickname"
                  (keydown.enter)="create()"
                  (keydown.escape)="adding.set(false)"
                />
                @if (namesakeHint(); as hint) {
                  <p class="hint">{{ hint }}</p>
                }
              </td>
              <td class="role">
                <input type="checkbox" aria-label="MJ" [(ngModel)]="newGameMaster" />
              </td>
              <td class="role">
                <input type="checkbox" aria-label="Organisateur" [(ngModel)]="newOrganizer" />
              </td>
              <td colspan="2" class="new-actions">
                <button type="button" appButton="primary" (click)="create()">Créer le compte</button>
                <button type="button" appButton="quiet" (click)="adding.set(false)">Annuler</button>
                @if (refusal()) {
                  <p class="refusal">{{ refusal() }}</p>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (!adding()) {
        <button type="button" appButton="secondary" (click)="openNew()">Créer un compte</button>
      }
    </div>
  `,
  styles: `
    @layer components {
      .subtitle {
        margin: var(--space-xs) 0 0;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }

      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        align-items: flex-start;
        padding: var(--space-l) var(--space-xl);
      }

      .filters {
        display: flex;
        gap: var(--space-xs);
      }

      .count {
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }

      table {
        width: 52rem;
      }

      .role {
        width: 7rem;
        text-align: center;
      }

      .access {
        font-size: var(--font-size-meta);

        span {
          display: inline-flex;
          gap: var(--space-xs);
          align-items: center;
        }
      }

      .pending {
        color: var(--warning, #b7791f);
      }

      .muted {
        color: var(--text-muted);
        font-weight: 400;
      }

      .actions {
        text-align: right;
      }

      .new td {
        vertical-align: top;
      }

      .new input[type='text'] {
        width: 100%;
      }

      .hint,
      .refusal {
        margin: var(--space-xs) 0 0;
        font-size: var(--font-size-meta);
      }

      .hint {
        color: var(--text-muted);
      }

      .refusal {
        color: var(--danger, #a33);
      }

      .new-actions {
        white-space: nowrap;
      }

      tbody tr:not(.new):hover {
        background: var(--surface-1);
      }
    }
  `,
})
export class VariantAAccountsPage {
  protected readonly store = inject(AccountsStore);
  protected readonly gestures = inject(AccountGestures);

  protected readonly filters = [
    { key: 'all', label: 'Tous les comptes' },
    { key: 'organizer', label: 'Organisateurs' },
    { key: 'game-master', label: 'MJ' },
    { key: 'waiting', label: 'Lien pas encore suivi' },
  ] as const;
  protected readonly filter = signal<(typeof this.filters)[number]['key']>('all');

  protected readonly adding = signal(false);
  protected nickname = '';
  protected newGameMaster = true;
  protected newOrganizer = false;
  protected readonly refusal = signal('');
  private readonly typed = signal('');

  protected readonly rows = computed(() =>
    this.store
      .people()
      .filter(hasAccount)
      .filter((person) => this.matches(person, this.filter()))
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'fr')),
  );

  protected readonly namesakeHint = computed(() => {
    const namesake = this.store.namesake(this.typed());
    if (!namesake) return '';
    if (hasAccount(namesake)) return `« ${namesake.nickname} » a déjà un compte : cochez ses rôles dans sa ligne.`;
    return `« ${namesake.nickname} » existe déjà comme participant : le compte s'ajoute à son pseudo.`;
  });

  protected isExpired(person: Person): boolean {
    return accessState(person) === 'expired';
  }

  protected count(key: (typeof this.filters)[number]['key']): number {
    return this.store.people().filter(hasAccount).filter((person) => this.matches(person, key)).length;
  }

  private matches(person: Person, key: string): boolean {
    if (key === 'organizer') return person.organizer;
    if (key === 'game-master') return person.gameMaster;
    if (key === 'waiting') return !!person.link;
    return true;
  }

  protected openNew(): void {
    this.nickname = '';
    this.newGameMaster = true;
    this.newOrganizer = false;
    this.refusal.set('');
    this.typed.set('');
    this.adding.set(true);
    queueMicrotask(() => document.querySelector<HTMLInputElement>('.new input[type=text]')?.focus());
  }

  protected ngDoCheck(): void {
    if (this.typed() !== this.nickname) this.typed.set(this.nickname);
  }

  protected create(): void {
    if (!this.nickname.trim()) return this.refusal.set('Saisissez un pseudo.');
    if (!this.newGameMaster && !this.newOrganizer) return this.refusal.set('Cochez au moins un rôle.');
    const namesake = this.store.namesake(this.nickname);
    if (namesake && hasAccount(namesake)) return this.refusal.set('Ce pseudo a déjà un compte.');
    const person = this.store.createAccount(this.nickname, {
      gameMaster: this.newGameMaster,
      organizer: this.newOrganizer,
    });
    this.adding.set(false);
    this.gestures.showLink(person, `Compte de « ${person.nickname} » créé`);
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
