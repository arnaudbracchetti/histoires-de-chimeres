import { Component, inject } from '@angular/core';
import { TabNavigation } from '../shell/tab-navigation';
import { Button } from '../ui/button';

/** L'Accueil, racine de l'historique. Sans affectation à montrer : la carte « Choisis tes parties ». */
@Component({
  selector: 'app-home-page',
  imports: [Button],
  template: `
    <h1 class="visually-hidden">Accueil</h1>
    <section class="card" aria-labelledby="choose-games">
      <span class="over">Inscriptions ouvertes</span>
      <h2 id="choose-games">Choisis tes parties</h2>
      <p>
        Inscris-toi à autant de parties que tu veux, sur chaque créneau. Chaque créneau est tiré au
        sort peu avant son début.
      </p>
      <div>
        <a
          href="/programme"
          appButton="primary"
          (click)="$event.preventDefault(); navigation.go('programme')"
        >
          Voir le programme
        </a>
      </div>
    </section>
  `,
  styles: `
    @layer components {
      .card {
        display: grid;
        gap: var(--space-s);
        padding: var(--space-l);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);
      }

      h2 {
        font-family: var(--font-display);
        font-size: var(--font-size-mobile-title);
        font-weight: normal;
      }
    }
  `,
})
export class HomePage {
  protected readonly navigation = inject(TabNavigation);
}
