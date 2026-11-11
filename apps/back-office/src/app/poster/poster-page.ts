import { DOCUMENT } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { buildFrontOfficeUrl } from '@chimeres/contract';
import { ConventionStore } from '../convention/convention-store';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { QrCode } from './qr-code';

/**
 * « Informations de connexion » (ID-15) : tout ce qu'il faut pour entrer dans le front office, à
 * montrer sur un écran de l'accueil. En paysage : à gauche, le QR code qui ouvre le front office
 * avec le code de présence, sur une tuile blanche d'environ 80 % de la hauteur disponible ; à
 * droite, le nom de la convention, les trois étapes et, pour qui ne lit pas le QR code, le domaine
 * et le code de présence en clair. Le front office est servi sur le domaine du back office.
 */
@Component({
  selector: 'app-poster-page',
  imports: [Loadable, PageHeader, QrCode],
  template: `
    <app-page-header title="Informations de connexion" />
    <app-loadable [resource]="store.convention" failure="Impossible de charger la convention.">
      @if (store.value(); as convention) {
        <div class="screen">
          <app-qr-code
            class="tile"
            [url]="frontOfficeUrl()"
            label="QR code de l'application des participants, avec le code de présence"
          />
          <div class="text">
            <h2 class="name">{{ convention.name }}</h2>
            <ol class="steps">
              <li><strong>Scanne</strong> le QR code.</li>
              <li>
                <strong>Suis bien les indications</strong> de ton téléphone, pour profiter de toutes
                les fonctions de l'application.
              </li>
              <li>
                <strong>Choisis ton pseudo</strong>, puis inscris-toi aux parties auxquelles tu
                aimerais jouer.
              </li>
            </ol>
            <section class="fallback" aria-labelledby="fallback-title">
              <h3 id="fallback-title">Tu n'arrives pas à lire le QR code&#8239;?</h3>
              <p>Va sur <strong>{{ host }}</strong> et tape le code</p>
              <p class="code">{{ convention.presenceCode }}</p>
            </section>
          </div>
        </div>
      }
    </app-loadable>
  `,
  styles: `
    @layer components {
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }

      app-loadable {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-height: 0;
      }

      /* La place sous l'en-tête : le QR et le texte s'y mesurent. */
      .screen {
        container-type: size;
        flex: 1;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: var(--space-xxl);
        align-items: center;
        padding: 0 var(--space-xxl);
      }

      .tile {
        width: min(80cqh, 55cqw);
        border-radius: var(--radius-card);
        overflow: hidden;
      }

      .text {
        display: flex;
        flex-direction: column;
        gap: var(--space-l);
        font-size: max(var(--font-size-block), 2.6cqh);
      }

      .name {
        font-family: var(--font-display);
        font-size: max(var(--font-size-title), 6cqh);
        font-weight: normal;
        line-height: var(--line-height-title);
        color: var(--accent);
      }

      .steps {
        display: flex;
        flex-direction: column;
        gap: var(--space-s);
        margin: 0;
        padding-left: var(--space-xl);
      }

      .fallback {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-l) var(--space-xl);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        background: var(--surface-2);

        h3 {
          font-size: inherit;
          font-weight: 600;
        }
      }

      .code {
        font-family: var(--font-caps);
        font-size: max(var(--font-size-title), 8cqh);
        line-height: var(--line-height-display);
        letter-spacing: 0.25em;
        color: var(--accent);
      }
    }
  `,
})
export class PosterPage {
  protected readonly store = inject(ConventionStore);
  private readonly location = inject(DOCUMENT).location;
  /** L'adresse à taper, réduite au nom de domaine : sans `https://` ni `/` final. */
  protected readonly host = this.location.host;
  protected readonly frontOfficeUrl = computed(() =>
    buildFrontOfficeUrl(this.location.origin, this.store.value()?.presenceCode ?? ''),
  );
}
