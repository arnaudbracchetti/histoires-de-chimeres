import { DOCUMENT } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { buildFrontOfficeUrl } from '@chimeres/contract';
import { ConventionStore } from '../convention/convention-store';
import { Loadable } from '../shell/loadable';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { QrCode } from './qr-code';

/**
 * « Informations de connexion » (ID-15) : tout ce qu'il faut pour entrer dans le front office, à
 * montrer sur un écran de l'accueil. En paysage : à gauche, le QR code qui ouvre le front office
 * avec le code de présence, sur une tuile blanche d'environ 80 % de la hauteur disponible ; à
 * droite, le nom de la convention, les trois étapes et, pour qui ne lit pas le QR code, le domaine
 * et le code de présence en clair. Le front office est servi sur le domaine du back office.
 *
 * « Imprimer l'affiche » imprime la page en une affiche A4 portrait (variante B du prototype #152) :
 * sur papier blanc, le nom de la convention et un sous-titre, le QR code centré (symbole de
 * 12 cm), l'encadré du code, puis les trois étapes sur trois colonnes. Le rail, l'en-tête et ses
 * boutons n'y sont pas.
 */
@Component({
  selector: 'app-poster-page',
  imports: [Button, Loadable, PageHeader, QrCode],
  template: `
    <app-page-header title="Informations de connexion">
      <button appButton="primary" type="button" (click)="print()">Imprimer l'affiche</button>
    </app-page-header>
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
            <p class="subtitle">
              Regarde le programme, inscris-toi, et sois notifié des informations importantes de
              cette journée
            </p>
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
              <p>
                Va sur <strong>{{ host }}</strong> et tape le code
              </p>
              <p class="code">{{ convention.presenceCode }}</p>
            </section>
          </div>
        </div>
      }
    </app-loadable>
  `,
  styles: `
    /* L'affiche : une feuille A4 portrait, sans marge, que la page remplit seule. */
    @page {
      size: A4 portrait;
      margin: 0;
    }

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

      .subtitle {
        display: none;
      }

      @media print {
        :host {
          display: block;
          height: auto;
        }

        app-page-header {
          display: none;
        }

        app-loadable {
          display: block;
        }

        /* La feuille : les éléments du texte s'y rangent dans l'ordre de l'affiche. */
        .screen {
          container-type: normal;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          width: 210mm;
          height: 297mm;
          overflow: hidden;
          padding: 8mm 15mm;
          background: var(--paper);
          color: var(--ink);
          font-size: 4.5mm;
          print-color-adjust: exact;

          > *,
          .text > * {
            flex: none;
          }
        }

        /* Sans boîte, mais il transmet sa taille d'écran : la feuille la reprend. */
        .text {
          display: contents;
          font-size: inherit;
        }

        .name {
          order: 1;
          font-size: 11mm;
          line-height: 1.1;
          text-align: center;
          color: var(--ink);
        }

        .subtitle {
          order: 2;
          display: block;
          margin-top: 2mm;
          font-size: 6mm;
          line-height: 1.3;
          text-align: center;
        }

        /*
         * Le symbole mesure 12 cm, la marge de 4 modules en plus : en dessous des 13 cm de #151,
         * pour laisser leur place aux étapes et à un nom de convention sur deux lignes.
         */
        .tile {
          order: 3;
          width: calc(120mm / var(--qr-symbol-share));
          border-radius: 0;
        }

        .fallback {
          order: 4;
          align-items: center;
          gap: 1mm;
          padding: 2mm 10mm;
          border: 0.6mm solid var(--ink);
          border-radius: 3mm;
          background: none;
          text-align: center;
        }

        .code {
          font-size: 11mm;
          line-height: 1.1;
          color: var(--ink);
        }

        .steps {
          order: 5;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6mm;
          width: 100%;
          margin-top: 8mm;
          padding: 0;
          font-size: 5mm;
          line-height: 1.3;
          list-style: none;

          li::before {
            content: counter(list-item);
            display: block;
            margin-bottom: 2mm;
            font-family: var(--font-display);
            font-size: 10mm;
            line-height: 1;
            color: var(--accent);
          }
        }
      }
    }
  `,
})
export class PosterPage {
  protected readonly store = inject(ConventionStore);
  private readonly document = inject(DOCUMENT);
  private readonly location = this.document.location;
  /** L'adresse à taper, réduite au nom de domaine : sans `https://` ni `/` final. */
  protected readonly host = this.location.host;
  protected readonly frontOfficeUrl = computed(() =>
    buildFrontOfficeUrl(this.location.origin, this.store.value()?.presenceCode ?? ''),
  );

  /** Ouvre la fenêtre d'impression du navigateur, qui imprime l'affiche. */
  protected print(): void {
    this.document.defaultView?.print();
  }
}
