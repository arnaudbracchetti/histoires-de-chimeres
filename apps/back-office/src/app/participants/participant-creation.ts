import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injectable,
  Injector,
  linkedSignal,
  signal,
} from '@angular/core';
import { form, FormField, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  participantEndpoints,
  type AccountRole,
  type AddedParticipantDto,
} from '@chimeres/contract';
import { fr } from '@chimeres/design';
import { injectApiCall } from '../api-call';
import { nicknameRules } from '../forms/nickname-rules';
import { submitWith } from '../forms/submit-with';
import { readNamesakeParticipantId } from '../problem';
import { Announcer } from '../shell/announcer';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { AccessLinkHandOver } from './access-link-hand-over';
import { RoleCard } from './role-card';

type DialogData = { gameMaster: boolean; titleId: string };

type Step = 'nickname' | 'roles' | 'link';

const STEPS: { step: Step; label: string }[] = [
  { step: 'nickname', label: '1. Pseudo' },
  { step: 'roles', label: '2. Rôles (facultatif)' },
  { step: 'link', label: "3. Lien d'accès" },
];

/** L'onglet « Compte » de la fiche d'un pseudo, dans l'URL. */
const ACCOUNT_TAB = { onglet: 'compte' };

let nextId = 0;

/**
 * L'assistant « Créer un pseudo » (ID-12, ID-16, docs/design/patterns.md, Participants), seule
 * façon de créer un pseudo, et donc un MJ : 1. le pseudo ; 2. ses rôles, facultatifs, en cartes à
 * cocher ; 3. le lien d'accès de son compte. Sans rôle, un simple participant : sa fiche s'ouvre,
 * sans lien. Avec un rôle, une seule requête crée le pseudo, son MJ éventuel et son compte, puis le
 * lien s'affiche ; « Voir sa fiche » ouvre son onglet « Compte ». Un pseudo déjà pris ramène au
 * pseudo, son refus sous le champ, suivi de « Voir sa fiche », vers l'onglet « Compte » du pseudo
 * qui le porte (ID-4).
 */
@Component({
  selector: 'app-participant-creation',
  imports: [AccessLinkHandOver, Button, Field, FormField, RoleCard, RouterLink],
  styleUrl: '../ui/dialog.css',
  template: `
    <ol class="steps">
      @for (item of steps; track item.step) {
        <li [attr.aria-current]="step() === item.step ? 'step' : null">{{ item.label }}</li>
      }
    </ol>
    @switch (step()) {
      @case ('nickname') {
        <h2 [id]="data.titleId">Créer un pseudo</h2>
        <app-field label="Pseudo">
          <input
            type="text"
            autocomplete="off"
            [formField]="form.nickname"
            (keydown.enter)="next()"
          />
          @if (namesakeId(); as participantId) {
            <a
              appFieldErrorAction
              [routerLink]="['/participants', participantId]"
              [queryParams]="accountTab"
              (click)="ref.close()"
              >Voir sa fiche</a
            >
          }
        </app-field>
      }
      @case ('roles') {
        <h2 [id]="data.titleId">{{ rolesTitle() }}</h2>
        <fieldset>
          <legend class="visually-hidden">Rôles dans le back office</legend>
          <app-role-card
            role="game-master"
            [checked]="gameMaster()"
            (pressed)="gameMaster.set(!gameMaster())"
          />
          <app-role-card
            role="organizer"
            [checked]="organizer()"
            (pressed)="organizer.set(!organizer())"
          />
        </fieldset>
        <p class="help">{{ withoutRole() }}</p>
      }
      @case ('link') {
        <h2 [id]="data.titleId">{{ linkTitle() }}</h2>
        @if (added()?.accessLink; as link) {
          <app-access-link-hand-over [link]="link" [nickname]="nickname()" />
        }
      }
    }
    <div class="actions">
      @switch (step()) {
        @case ('nickname') {
          <button type="button" appButton="quiet" (click)="ref.close()">Annuler</button>
          <button type="button" appButton="primary" (click)="next()">Suivant</button>
        }
        @case ('roles') {
          <button type="button" appButton="quiet" (click)="ref.close()">Annuler</button>
          <button type="button" appButton="quiet" (click)="step.set('nickname')">Retour</button>
          <button type="button" appButton="primary" (click)="create()">
            {{ createLabel() }}
          </button>
        }
        @case ('link') {
          <button type="button" appButton="secondary" (click)="openSheet()">Voir sa fiche</button>
          <button type="button" appButton="primary" class="done" (click)="ref.close(added())">
            Terminé
          </button>
        }
      }
    </div>
  `,
  styles: `
    @layer components {
      :host {
        width: 36rem;
      }

      p {
        margin: 0;
      }

      .steps {
        display: flex;
        gap: var(--space-m);
        margin: 0;
        padding: 0;
        color: var(--text-muted);
        font-size: var(--font-size-meta);
        list-style: none;

        [aria-current] {
          color: var(--text);
          font-weight: 600;
        }
      }

      input {
        width: 100%;
      }

      [appFieldErrorAction] {
        margin-left: var(--space-xs);
        color: var(--text);
      }

      fieldset {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        margin: 0;
        padding: 0;
        border: 0;
      }

      .help {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
  `,
})
export class ParticipantCreationWizard {
  protected readonly data = inject<DialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<AddedParticipantDto>>(DialogRef);
  private readonly apiCall = injectApiCall();
  private readonly announcer = inject(Announcer);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  protected readonly steps = STEPS;
  protected readonly accountTab = ACCOUNT_TAB;
  protected readonly step = signal<Step>('nickname');
  protected readonly gameMaster = signal(this.data.gameMaster);
  protected readonly organizer = signal(false);
  /** Le pseudo créé, avec son lien d'accès. */
  protected readonly added = signal<AddedParticipantDto | undefined>(undefined);

  private readonly model = signal({ nickname: '' });
  protected readonly nickname = computed(() => this.model().nickname.trim());

  /** Le participant qui porte déjà le pseudo refusé ; oublié dès que le pseudo change. */
  protected readonly namesakeId = linkedSignal<string, string | undefined>({
    source: () => this.model().nickname,
    computation: () => undefined,
  });

  protected readonly form = form(
    this.model,
    (path) => nicknameRules(path.nickname, 'participant'),
    {
      submission: submitWith(() => this.write(), {
        beforeFocus: () => this.step.set('nickname'),
      }),
    },
  );

  private readonly roles = computed<AccountRole[]>(() => [
    ...(this.gameMaster() ? (['game-master'] as const) : []),
    ...(this.organizer() ? (['organizer'] as const) : []),
  ]);

  protected readonly rolesTitle = computed(() => fr`Rôles de « ${this.nickname()} »`);
  protected readonly linkTitle = computed(() => fr`Lien d'accès de « ${this.nickname()} »`);
  protected readonly withoutRole = computed(
    () =>
      fr`Sans rôle, « ${this.nickname()} » est un simple participant, sans accès au back office. Un rôle se donne aussi plus tard, dans l'onglet « Compte » de sa fiche.`,
  );
  protected readonly createLabel = computed(() => {
    if (this.form().submitting()) return 'Enregistrement…';
    return this.roles().length ? 'Créer le pseudo et son compte' : 'Créer le pseudo';
  });

  /** Passe aux rôles, si le pseudo est valable ; sinon, son erreur s'affiche. */
  protected next(): void {
    const nickname = this.form.nickname();
    nickname.markAsTouched();
    if (nickname.invalid()) return;
    this.step.set('roles');
    this.focusAfterRender('app-role-card input');
  }

  protected create(): void {
    void submit(this.form);
  }

  protected openSheet(): void {
    const added = this.added()!;
    void this.router.navigate(['/participants', added.participantId], {
      queryParams: ACCOUNT_TAB,
    });
    this.ref.close(added);
  }

  private async write(): Promise<void> {
    const nickname = this.nickname();
    let added: AddedParticipantDto;
    try {
      added = await this.apiCall(participantEndpoints.add, {
        body: { nickname, roles: this.roles() },
      });
    } catch (error) {
      this.namesakeId.set(readNamesakeParticipantId(error));
      throw error;
    }
    this.announcer.announce(fr`Pseudo « ${nickname} » créé.`);
    if (!added.accessLink) {
      void this.router.navigate(['/participants', added.participantId]);
      this.ref.close(added);
      return;
    }
    this.added.set(added);
    this.step.set('link');
    this.focusAfterRender('.done');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

/** Ouvre l'assistant. À sa fermeture, le focus revient à l'élément qui l'a ouvert. */
@Injectable({ providedIn: 'root' })
export class ParticipantCreation {
  private readonly dialog = inject(Dialog);

  /**
   * `gameMaster` coche le rôle MJ d'avance (« Ajouter un MJ »). Résout le pseudo créé, ou
   * `undefined` si l'assistant se ferme sans lui.
   */
  open({ gameMaster = false }: { gameMaster?: boolean } = {}): Promise<
    AddedParticipantDto | undefined
  > {
    const titleId = `participant-creation-${nextId++}`;
    const ref = this.dialog.open<AddedParticipantDto, DialogData, ParticipantCreationWizard>(
      ParticipantCreationWizard,
      {
        data: { gameMaster, titleId },
        ariaLabelledBy: titleId,
        autoFocus: 'input',
        restoreFocus: true,
      },
    );
    return firstValueFrom(ref.closed);
  }
}
