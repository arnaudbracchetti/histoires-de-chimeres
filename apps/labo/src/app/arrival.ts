import { Component, inject, input, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { api, Lab, time } from './lab';

// Page ouverte par le tap sur une notification : `via` dit quel chemin l'a ouverte
// (`navigate` du format déclaratif, ou `onActionClick` du service worker d'Angular).
@Component({
  imports: [RouterLink],
  template: `
    <h1>Ouvert par une notification</h1>
    <section>
      <dl>
        <dt>Notification</dt>
        <dd>n°{{ n() }}</dd>
        <dt>Chemin</dt>
        <dd>{{ via() }}</dd>
        <dt>Chargement</dt>
        <dd>{{ loading }}</dd>
        <dt>Page chargée à</dt>
        <dd>{{ loadedAt }}</dd>
        <dt>Contexte</dt>
        <dd>{{ lab.context }}</dd>
      </dl>
      <p><a routerLink="/">Accueil du labo</a></p>
    </section>
  `,
})
export class Arrival implements OnInit {
  protected readonly lab = inject(Lab);
  readonly n = input('?');
  readonly via = input('?');
  // Chargement complet de la page (démarrage, ou `client.navigate` du worker) ou navigation interne.
  protected readonly loading = this.lab.boot.href.includes('/arrivee')
    ? `page chargée à cette adresse (${(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? '?'})`
    : 'navigation dans l’app déjà ouverte';
  protected readonly loadedAt = time(this.lab.boot.at);

  ngOnInit() {
    this.lab.log(`Ouvert par la notification n°${this.n()} (${this.via()}) : ${this.loading}`);
    void api('POST', '/api/clics', { phoneId: this.lab.phoneId, n: Number(this.n()), via: this.via() }).catch(() => {});
  }
}
