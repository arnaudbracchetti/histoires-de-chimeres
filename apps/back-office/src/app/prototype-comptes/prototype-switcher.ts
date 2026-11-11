import { Component, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AccountsStore, VARIANTS, type Variant } from './accounts-store';

/** Page d'arrivée de chaque variante. */
const HOME: Record<Variant, string> = {
  A: '/prototype-comptes',
  B: '/prototype-comptes/pseudos',
  C: '/prototype-comptes/pseudos',
  D: '/prototype-comptes/pseudos',
};

/**
 * PROTOTYPE JETABLE (#169) : barre flottante. ← → change de variante. Ne fait pas partie du
 * design évalué. Vous êtes « Aldric », Organisateur.
 */
@Component({
  selector: 'app-prototype-switcher',
  template: `
    <button type="button" (click)="cycle(-1)" aria-label="Variante précédente">←</button>
    <span class="label">{{ store.variant() }} · {{ store.variantName() }}</span>
    <button type="button" (click)="cycle(1)" aria-label="Variante suivante">→</button>
  `,
  styles: `
    :host {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: #111;
      color: #fff;
      font: 13px/1.2 system-ui, sans-serif;
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.4);
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 4px 10px;
      background: #333;
      color: #fff;
      font: inherit;
      cursor: pointer;
    }

    .label {
      min-width: 18rem;
      text-align: center;
    }
  `,
})
export class PrototypeSwitcher {
  protected readonly store = inject(AccountsStore);
  private readonly router = inject(Router);

  protected cycle(step: number): void {
    const index = VARIANTS.findIndex(({ key }) => key === this.store.variant());
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length].key;
    this.store.setVariant(next);
    void this.router.navigateByUrl(`${HOME[next]}?variante=${next}`);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable], [role=dialog], [role=alertdialog]'))
      return;
    if (event.key === 'ArrowLeft') this.cycle(-1);
    if (event.key === 'ArrowRight') this.cycle(1);
  }
}
