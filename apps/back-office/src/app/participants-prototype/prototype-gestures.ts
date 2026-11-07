/**
 * PROTOTYPE, à jeter (#135). Petits morceaux communs aux variantes : champ de pseudo (création ou
 * renommage) avec refus et lien vers la fiche, dialogue de fusion, confirmations.
 */
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, Injectable, input, output, signal } from '@angular/core';
import { Button } from '../ui/button';
import { Confirmation } from '../ui/confirmation';
import { normalize, PrototypeStore, type Pseudo, type Refusal } from './prototype-data';

/** Un champ de pseudo, sur une ligne : Entrée valide, Échap annule. Le refus reste sous le champ. */
@Component({
  selector: 'app-pseudo-field',
  imports: [Button],
  template: `
    <form (submit)="$event.preventDefault(); submit()">
      <input
        #field
        [value]="initial()"
        [attr.aria-label]="label()"
        [placeholder]="label()"
        (input)="value.set(field.value); refusal.set(undefined)"
        (keydown.escape)="cancelled.emit()"
        autofocus
      />
      <button type="submit" appButton="primary">{{ action() }}</button>
      <button type="button" appButton="quiet" (click)="cancelled.emit()">Annuler</button>
    </form>
    <p class="refusal" role="alert">
      @if (refusal(); as r) {
        {{ r.message }}
        @if (r.pseudoId) {
          <button type="button" appButton="quiet" class="see" (click)="open.emit(r.pseudoId)">
            Voir sa fiche
          </button>
        }
      }
    </p>
  `,
  styles: `
    form {
      display: flex;
      gap: var(--space-s);
      align-items: center;
    }
    input {
      width: 14rem;
    }
    .refusal {
      min-height: 1.6em;
      margin: var(--space-xxs) 0 0;
      color: var(--danger);
      font-size: var(--font-size-meta);
    }
    .see {
      font-size: inherit;
      text-decoration: underline;
    }
  `,
})
export class PseudoField {
  readonly label = input('Pseudo');
  readonly action = input('Enregistrer');
  readonly initial = input('');
  /** Le geste : rend un refus, ou rien. */
  readonly run = input.required<(value: string) => Refusal | undefined>();
  readonly cancelled = output();
  readonly done = output();
  readonly open = output<string>();
  protected readonly value = signal('');
  protected readonly refusal = signal<Refusal | undefined>(undefined);

  ngOnInit() {
    this.value.set(this.initial());
  }

  protected submit(): void {
    const refusal = this.run()(this.value());
    this.refusal.set(refusal);
    if (!refusal) this.done.emit();
  }
}

type MergeData = { source: Pseudo };

/** Dialogue de fusion : on choisit la destination, on lit ce qui arrivera, on confirme. */
@Component({
  selector: 'app-merge-dialog',
  imports: [Button],
  template: `
    <h2>Fusionner « {{ data.source.nickname }} » dans un autre pseudo</h2>
    <input
      #q
      placeholder="Chercher la destination"
      aria-label="Chercher la destination"
      (input)="query.set(q.value)"
      autofocus
    />
    <ul class="choices">
      @for (p of candidates(); track p.id) {
        <li>
          <label>
            <input
              type="radio"
              name="target"
              [checked]="target() === p.id"
              (change)="target.set(p.id)"
            />
            {{ p.nickname }}
            @if (p.kind === 'gm') {
              <span class="tag">MJ</span>
            }
          </label>
        </li>
      }
    </ul>
    @if (target(); as t) {
      <div class="consequences">
        @for (line of store.mergeConsequences(data.source.id, t); track $index) {
          <p>{{ line }}</p>
        }
      </div>
    }
    <div class="actions">
      <button type="button" appButton="quiet" (click)="ref.close(undefined)">Annuler</button>
      @if (target(); as t) {
        <button type="button" appButton="danger" (click)="ref.close(t)">
          Fusionner dans « {{ store.nickname(t) }} »
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-m);
      width: 34rem;
      padding: var(--space-l);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface-2);
    }
    h2 {
      font-size: var(--font-size-section);
    }
    .choices {
      max-height: 12rem;
      overflow: auto;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    label {
      display: flex;
      gap: var(--space-s);
      align-items: center;
      padding: var(--space-xxs) 0;
    }
    .tag {
      padding: 0 var(--space-xs);
      border-radius: 999px;
      background: var(--surface-3);
      color: var(--text-muted);
      font-size: var(--font-size-overline);
    }
    .consequences p {
      margin: 0 0 var(--space-xs);
    }
    .actions {
      display: flex;
      gap: var(--space-s);
      justify-content: flex-end;
    }
  `,
})
export class MergeDialog {
  protected readonly data = inject<MergeData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string | undefined>>(DialogRef);
  protected readonly store = inject(PrototypeStore);
  protected readonly query = signal('');
  protected readonly target = signal<string | undefined>(undefined);
  protected readonly candidates = computed(() => {
    const q = normalize(this.query());
    return this.store
      .sorted()
      .filter((p) => p.id !== this.data.source.id && normalize(p.nickname).includes(q))
      .slice(0, 30);
  });
}

/** Les gestes à confirmation, communs aux variantes. Rendent `true` si le geste a eu lieu. */
@Injectable({ providedIn: 'root' })
export class PrototypeGestures {
  private readonly store = inject(PrototypeStore);
  private readonly confirmation = inject(Confirmation);
  private readonly dialog = inject(Dialog);

  cutLinks(p: Pseudo): Promise<boolean> {
    return this.confirmation.ask({
      question: `Couper les liens de « ${p.nickname} » ?`,
      consequences: [
        `Ses ${p.phones.length} téléphone(s) reviendront à l’identification à leur prochain échange avec le serveur.`,
        'Le pseudo garde ses inscriptions ; on pourra le relier de nouveau.',
      ],
      confirmLabel: 'Couper les liens',
      action: async () => this.store.cutLinks(p.id),
    });
  }

  remove(p: Pseudo): Promise<boolean> {
    return this.confirmation.ask({
      question: `Supprimer le pseudo « ${p.nickname} » ?`,
      consequences: this.store.removeConsequences(p.id),
      confirmLabel: 'Supprimer le pseudo',
      action: async () => this.store.remove(p.id),
    });
  }

  /** Rend l'id de la destination, ou rien. */
  async merge(p: Pseudo): Promise<string | undefined> {
    const ref = this.dialog.open<string | undefined, MergeData>(MergeDialog, {
      data: { source: p },
    });
    const target = await new Promise<string | undefined>((resolve) =>
      ref.closed.subscribe((value) => resolve(value)),
    );
    if (target) this.store.merge(p.id, target);
    return target;
  }

  /** Même confirmation que « Rouvrir les inscriptions » du pilotage (TI-6). */
  reopen(slotId: string): Promise<boolean> {
    const rank = this.store.slot(slotId).rank;
    return this.confirmation.ask({
      question: `Rouvrir les inscriptions du créneau ${rank} ?`,
      consequences: [
        'Le résultat provisoire sera effacé, avec ses déplacements et ses parties annulées.',
        'Personne n’est notifié : chacun retrouve ses inscriptions, et peut en changer jusqu’au prochain tirage.',
      ],
      confirmLabel: 'Rouvrir les inscriptions',
      action: async () => this.store.reopen(slotId),
    });
  }

  /** Rend le refus, s'il y en a un ; sinon demande confirmation. */
  async addLatecomer(p: Pseudo, slotId: string): Promise<string | undefined> {
    if (p.results[slotId]) return `« ${p.nickname} » est déjà dans ce tirage.`;
    if (this.store.leadsOn(p.id, slotId)) return `« ${p.nickname} » mène une partie sur ce créneau.`;
    await this.confirmation.ask({
      question: `Ajouter « ${p.nickname} » au tirage publié du créneau ${this.store.slot(slotId).rank} ?`,
      consequences: [
        'Il y entre comme non placé : il ne prend la place de personne.',
        'Il reçoit la notification « retardataire », avec les tables où il reste de la place. L’ajout ne se défait pas.',
      ],
      confirmLabel: 'Ajouter comme non placé',
      tone: 'primary',
      action: async () => this.store.addLatecomer(p.id, slotId),
    });
    return undefined;
  }
}
