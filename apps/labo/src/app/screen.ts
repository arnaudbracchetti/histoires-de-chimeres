import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Lab } from './lab';

// Écrans empilés dans l'historique (pushState du routeur) pour essayer le retour.
@Component({
  imports: [RouterLink],
  template: `
    <h1>Écran {{ n() }}</h1>
    <section>
      <p>Chaque « Écran suivant » ajoute une entrée à l'historique. Essaie ensuite le bouton retour d'Android,
        ou le geste depuis le bord gauche de l'iPhone.</p>
      <dl>
        <dt>history.length</dt>
        <dd>{{ length }}</dd>
        <dt>Contexte</dt>
        <dd>{{ lab.context }}</dd>
      </dl>
      <button class="primary" (click)="next()">Écran suivant</button>
      <button (click)="history.back()">history.back()</button>
      <p><a routerLink="/">Accueil du labo</a></p>
    </section>
  `,
})
export class Screen {
  protected readonly lab = inject(Lab);
  private readonly router = inject(Router);
  readonly n = input.required<string>();
  private readonly number = computed(() => Number(this.n()));
  protected readonly history = history;
  protected get length() {
    return history.length;
  }

  next() {
    void this.router.navigate(['/ecran', this.number() + 1]);
    this.lab.log(`Écran ${this.number() + 1} empilé`);
  }
}
