import { Component, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PrototypeState, VARIANTS, type Role } from './prototype-state';

/** Page d'arrivée de chaque variante, selon le rôle simulé. */
export function homeOf(variant: string, role: Role): string {
  if (role === 'off') return '/';
  if (variant === 'C') return role === 'mj' ? '/prototype-espace-mj/accueil' : '/';
  if (variant === 'A' && role === 'mj-orga') return '/';
  return '/prototype-espace-mj/ma-fiche';
}

/**
 * PROTOTYPE JETABLE (#171) : barre flottante. ← → change de variante, le menu change le rôle
 * simulé et le MJ « connecté ». Ne fait pas partie du design évalué.
 */
@Component({
  selector: 'app-prototype-switcher',
  template: `
    <button type="button" (click)="cycle(-1)" aria-label="Variante précédente">←</button>
    <span class="label">{{ state.variant() }} · {{ state.variantName() }}</span>
    <button type="button" (click)="cycle(1)" aria-label="Variante suivante">→</button>
    <select [value]="state.role()" (change)="role($any($event.target).value)" aria-label="Rôle simulé">
      <option value="mj">MJ seul</option>
      <option value="mj-orga">MJ + Organisateur</option>
      <option value="off">Organisateur (actuel)</option>
    </select>
    <select
      [value]="state.me()?.id ?? ''"
      (change)="gameMaster($any($event.target).value)"
      aria-label="MJ connecté"
    >
      @for (gameMaster of state.gameMasters.hasValue() ? state.gameMasters.value() ?? [] : []; track gameMaster.id) {
        <option [value]="gameMaster.id" [selected]="gameMaster.id === state.me()?.id">
          {{ gameMaster.nickname }}
        </option>
      }
    </select>
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

    button,
    select {
      border: 0;
      border-radius: 999px;
      padding: 4px 10px;
      background: #333;
      color: #fff;
      font: inherit;
      cursor: pointer;
    }

    .label {
      min-width: 16rem;
      text-align: center;
    }
  `,
})
export class PrototypeSwitcher {
  protected readonly state = inject(PrototypeState);
  private readonly router = inject(Router);

  protected cycle(step: number): void {
    const index = VARIANTS.findIndex((variant) => variant.key === this.state.variant());
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length].key;
    this.state.set({ variant: next });
    this.goHome();
  }

  protected role(role: Role): void {
    this.state.set({ role });
    this.goHome();
  }

  protected gameMaster(id: string): void {
    this.state.set({ gameMasterId: id });
    this.goHome();
  }

  private goHome(): void {
    void this.router.navigateByUrl(
      homeOf(this.state.variant(), this.state.role()) +
        `?variante=${this.state.variant()}&role=${this.state.role()}` +
        (this.state.me() ? `&mj=${this.state.me()!.id}` : ''),
    );
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') this.cycle(-1);
    if (event.key === 'ArrowRight') this.cycle(1);
  }
}
