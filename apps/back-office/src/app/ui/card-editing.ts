import { afterNextRender, computed, ElementRef, inject, Injector, signal } from '@angular/core';
import { Confirmation, type ConfirmationRequest } from './confirmation';

/**
 * Comportement d'une liste de cartes à saisie en place (docs/design/patterns.md, Créneaux et
 * Tables) : une seule carte en saisie à la fois, saisie à la chaîne, focus rendu à la carte, à
 * « Ajouter… », ou à la carte suivante après une suppression. À créer dans un champ du composant
 * de la liste, dont les cartes sont des `article[appCard]` et la carte d'ajout un `button[appAddCard]`.
 */
export class CardEditing {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly confirmation = inject(Confirmation);

  private readonly editedId = signal<string | undefined>(undefined);
  /** La carte d'ajout : une clé neuve à chaque carte ouverte (pour la recréer vide), ou aucune. */
  readonly newKeys = signal<number[]>([]);
  private nextKey = 0;

  /** La carte en saisie : l'identifiant d'un élément, `new` pour un ajout, ou rien. */
  readonly editing = computed(() => (this.newKeys().length ? 'new' : this.editedId()));

  /** La carte est estompée : une autre est en saisie. */
  isDimmed(id: string | 'new'): boolean {
    const editing = this.editing();
    return editing !== undefined && editing !== id;
  }

  /** Ouvre une carte d'ajout vide, en dernier ; aussi après chaque ajout (saisie à la chaîne). */
  openNew(): void {
    this.editedId.set(undefined);
    this.newKeys.set([this.nextKey++]);
  }

  /** Ferme la carte d'ajout ; le focus revient à « Ajouter… ». */
  closeNew(): void {
    this.newKeys.set([]);
    this.focusAfterRender(() => this.host.querySelector('.add'));
  }

  edit(id: string): void {
    this.newKeys.set([]);
    this.editedId.set(id);
  }

  /** Ferme la saisie d'une carte, enregistrée ou non ; le focus revient à la carte. */
  close(id: string): void {
    this.editedId.set(undefined);
    this.focusAfterRender(() => this.host.querySelector(`article[data-card="${id}"]`));
  }

  /**
   * Demande confirmation, puis supprime par `request.action`. Résout `true` une fois supprimé ;
   * le focus va alors à la carte qui a pris la place de `index`, à défaut à la précédente, à
   * défaut à « Ajouter… ».
   */
  async remove(index: number, request: ConfirmationRequest): Promise<boolean> {
    const removed = await this.confirmation.ask(request);
    if (removed) {
      this.focusAfterRender(() => {
        const cards = this.host.querySelectorAll<HTMLElement>('article.card');
        return cards[index] ?? cards[index - 1] ?? this.host.querySelector('.add');
      });
    }
    return removed;
  }

  private focusAfterRender(target: () => Element | null): void {
    afterNextRender(() => (target() as HTMLElement | null)?.focus(), {
      injector: this.injector,
    });
  }
}
