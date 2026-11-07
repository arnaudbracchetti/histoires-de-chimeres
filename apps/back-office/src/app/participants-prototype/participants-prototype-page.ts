/**
 * PROTOTYPE, à jeter (#135). Trois variantes des écrans des pseudos, sur /gestion/participants,
 * switchables par ?variant=A|B|C (barre en bas, ou ← →). Données en mémoire, rien ne part à l'API.
 */
import { Component, input } from '@angular/core';
import { PrototypeSwitcher, type VariantInfo } from './prototype-switcher';
import { VariantAList, VariantASheet } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';
import { CleanVariant } from './variant-clean';

/** Deuxième tour : D, E, F. A, B et C restent joignables par l'URL. */
const VARIANTS: VariantInfo[] = [
  { key: 'E3a', name: 'Liste · ronds' },
  { key: 'E3s', name: 'Liste · barres obliques' },
];

/** La dernière variante vue : un lien sans ?variant= (fil d'Ariane) la garde. */
let lastVariant = 'E3a';

@Component({
  selector: 'app-participants-prototype-page',
  imports: [CleanVariant, PrototypeSwitcher, VariantAList, VariantASheet, VariantB, VariantC],
  template: `
    @switch (current()) {
      @case ('B') {
        <app-variant-b />
      }
      @case ('C') {
        <app-variant-c />
      }
      @case ('A') {
        @if (id()) {
          <app-variant-a-sheet [id]="id()!" />
        } @else {
          <app-variant-a-list />
        }
      }
      @default {
        <app-clean-variant [variant]="current()" [id]="id()" />
      }
    }
    <app-prototype-switcher [variants]="variants" [current]="current()" />
  `,
})
export class ParticipantsPrototypePage {
  readonly variant = input<string>();
  readonly id = input<string>();
  protected readonly variants = VARIANTS;

  protected current(): string {
    if (this.variant()) lastVariant = this.variant()!;
    return lastVariant;
  }
}
