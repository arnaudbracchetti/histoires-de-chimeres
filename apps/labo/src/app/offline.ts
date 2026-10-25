import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { api, dateTime, Lab } from './lab';

interface Programme {
  generatedAt: number;
  parties: { creneau: number; titre: string; jeu: string; table: number }[];
}

// Données en `freshness` (3 s, 7 jours) : sans réseau, la date dit que la page vient du cache.
@Component({
  imports: [RouterLink],
  template: `
    <h1>Programme hors ligne</h1>
    <section>
      <p>Ouvre cette page une fois avec du réseau. Puis mode avion, ferme l'app, rouvre-la ici.</p>
      @if (programme(); as p) {
        <dl>
          <dt>Écrit par le serveur</dt>
          <dd>{{ dateTime(p.generatedAt) }}</dd>
          <dt>Âge</dt>
          <dd>{{ age(p.generatedAt) }}</dd>
        </dl>
        <ul>
          @for (partie of p.parties; track partie.titre) {
            <li>Créneau {{ partie.creneau }} : {{ partie.titre }} · {{ partie.jeu }}, table {{ partie.table }}</li>
          }
        </ul>
      }
      @if (error()) {
        <p class="ko">{{ error() }}</p>
      }
      <button class="primary" (click)="load()">Relire</button>
      <p><a routerLink="/">Accueil du labo</a></p>
    </section>
  `,
})
export class Offline implements OnInit {
  private readonly lab = inject(Lab);
  protected readonly programme = signal<Programme | null>(null);
  protected readonly error = signal('');
  protected readonly dateTime = dateTime;

  ngOnInit() {
    void this.load();
  }

  protected age(at: number) {
    return `${Math.round((Date.now() - at) / 1000)} s`;
  }

  async load() {
    const started = Date.now();
    try {
      const programme = await api<Programme>('GET', '/api/programme');
      this.programme.set(programme);
      this.error.set('');
      this.lab.log(`Programme lu en ${Date.now() - started} ms, écrit il y a ${this.age(programme.generatedAt)}`);
    } catch (error) {
      this.error.set(String(error));
      this.lab.log(`Programme : ${error}`);
    }
  }
}
