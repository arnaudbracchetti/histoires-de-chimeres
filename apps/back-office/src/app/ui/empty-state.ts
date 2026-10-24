import { Component } from '@angular/core';

/**
 * État vide d'une page ou d'une liste (docs/design/patterns.md, Chargement, état vide) : le motif
 * gravé, puis le contenu projeté, une phrase et son invitation en bouton principal, parfois suivie
 * d'une seconde, discrète. Le filtre sans résultat, lui, reste sobre : il ne passe pas par ici.
 */
@Component({
  selector: 'app-empty-state',
  host: { class: 'empty' },
  template: `
    <svg class="engraving" aria-hidden="true" focusable="false">
      <use href="illustration.svg#engraving" />
    </svg>
    <ng-content />
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        align-items: center;
        width: 32rem;
        padding: var(--space-xxl);
        color: var(--text-muted);
        text-align: center;
      }

      .engraving {
        width: 160px;
        height: 160px;
        color: var(--engraving);
      }
    }
  `,
})
export class EmptyState {}
