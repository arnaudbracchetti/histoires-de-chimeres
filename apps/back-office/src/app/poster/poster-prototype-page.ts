/*
 * PROTOTYPE JETABLE (wayfinder #152) : à ne pas fusionner sur main.
 * Trois variantes de l'affiche (page d'impression A4 + vue plein écran), sur /gestion/prototype-affiche,
 * à choisir par ?variant=A|B|C ou par la barre en bas de page (← et → au clavier).
 */
import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { correction, generate } from 'lean-qr';
import { PRESENCE_CODE_PARAM } from '@chimeres/contract';
import { ConventionStore } from '../convention/convention-store';

/** Le QR code en SVG, marge normative de 4 modules comprise, modules en noir sur blanc. */
@Component({
  selector: 'app-proto-qr',
  template: `
    <svg
      [attr.viewBox]="viewBox()"
      shape-rendering="crispEdges"
      role="img"
      [attr.aria-label]="'QR code vers ' + url()"
    >
      <rect [attr.width]="side()" [attr.height]="side()" fill="#fff" />
      <path [attr.d]="path()" fill="#000" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
class ProtoQr {
  readonly url = input.required<string>();
  private readonly code = computed(() =>
    generate(this.url(), { minCorrectionLevel: correction.M }),
  );
  protected readonly side = computed(() => this.code().size + 8);
  protected readonly viewBox = computed(() => `0 0 ${this.side()} ${this.side()}`);
  protected readonly path = computed(() => {
    const code = this.code();
    let d = '';
    for (let y = 0; y < code.size; y++) {
      for (let x = 0; x < code.size; x++) {
        if (code.get(x, y)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
      }
    }
    return d;
  });
}

type Variant = { key: 'A' | 'B' | 'C'; name: string; orientation: 'portrait' | 'landscape' };

const VARIANTS: readonly Variant[] = [
  { key: 'A', name: 'Charbon, une colonne, même mise en page partout', orientation: 'portrait' },
  { key: 'B', name: 'Papier clair à imprimer, écran sombre à part', orientation: 'portrait' },
  { key: 'C', name: 'Paysage en deux volets, pensé écran', orientation: 'landscape' },
];

@Component({
  selector: 'app-poster-prototype-page',
  imports: [ProtoQr],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="proto-page" [attr.data-variant]="variant().key">
      <header class="proto-toolbar">
        <h1>Affiche</h1>
        <p class="proto-help">
          Une affiche A4 à imprimer, et la même chose en plein écran sur l'ordinateur de l'accueil.
        </p>
        <div class="proto-actions">
          <button type="button" (click)="print()">Imprimer l'affiche</button>
          <button type="button" (click)="fullscreen()">Afficher en plein écran</button>
          <a [href]="url()" target="_blank" rel="noopener">{{ url() }}</a>
        </div>
      </header>

      <div class="proto-previews">
        <figure>
          <figcaption>Affiche A4 {{ variant().orientation === 'portrait' ? 'portrait' : 'paysage' }}</figcaption>
          <div class="proto-sheet-frame">
            <!-- ======== FEUILLE IMPRIMÉE ======== -->
            @switch (variant().key) {
              @case ('A') {
                <article class="sheet sheet-a">
                  <svg class="engraving" viewBox="0 0 100 100" aria-hidden="true">
                    <circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="38" />
                    <circle cx="50" cy="50" r="30" />
                  </svg>
                  <p class="overline">Bienvenue à</p>
                  <h2 class="name">{{ name() }}</h2>
                  <div class="qr-tile"><app-proto-qr [url]="url()" /></div>
                  <p class="code-line">
                    <span class="label">Code de présence</span>
                    <span class="code">{{ code() }}</span>
                  </p>
                  <ol class="steps">
                    <li><span><b>Scanne</b> le QR code avec l'appareil photo de ton téléphone.</span></li>
                    <li>
                      <span><b>Sur iPhone</b>, ajoute l'application à l'écran d'accueil, puis
                      ouvre-la et tape le code {{ code() }}.</span>
                    </li>
                    <li><span><b>Choisis ton pseudo</b>&nbsp;: c'est tout.</span></li>
                  </ol>
                  <p class="address">Sans QR code&nbsp;: {{ host() }}</p>
                  <p class="by">par les Tisseurs de Chimères</p>
                </article>
              }
              @case ('B') {
                <article class="sheet sheet-b">
                  <h2 class="name">{{ name() }}</h2>
                  <p class="subtitle">Ton programme, tes parties et tes tables, sur ton téléphone</p>
                  <div class="qr"><app-proto-qr [url]="url()" /></div>
                  <div class="code-box">
                    <p class="label">Tu n'arrives pas à lire le QR code&nbsp;?</p>
                    <p>Va sur <b>{{ host() }}</b> et tape le code</p>
                    <p class="code">{{ code() }}</p>
                  </div>
                  <ol class="steps">
                    <li>
                      <span class="num">1</span>
                      <span><b>Scanne</b> le QR code.</span>
                    </li>
                    <li>
                      <span class="num">2</span>
                      <span><b>Suis bien les indications</b> de ton téléphone, pour profiter de
                      toutes les fonctions de l'application.</span>
                    </li>
                    <li>
                      <span class="num">3</span>
                      <span><b>Choisis ton pseudo</b>, puis inscris-toi aux parties auxquelles tu
                      aimerais jouer.</span>
                    </li>
                  </ol>
                </article>
              }
              @case ('C') {
                <article class="sheet sheet-c">
                  <div class="left">
                    <div class="qr"><app-proto-qr [url]="url()" /></div>
                  </div>
                  <div class="right">
                    <p class="overline">Histoires de Chimères</p>
                    <h2 class="name">{{ name() }}</h2>
                    <ol class="steps">
                      <li>Scanne le QR code.</li>
                      <li>Sur iPhone, ajoute l'application à l'écran d'accueil.</li>
                      <li>Choisis ton pseudo.</li>
                    </ol>
                    <div class="fallback">
                      <p class="label">Pas de QR code&nbsp;?</p>
                      <p>Va sur <b>{{ host() }}</b></p>
                      <p>et tape le code</p>
                      <p class="code">{{ code() }}</p>
                    </div>
                  </div>
                </article>
              }
            }
          </div>
        </figure>

        <figure>
          <figcaption>Plein écran (aperçu 16:9)</figcaption>
          <!-- ======== VUE PLEIN ÉCRAN ======== -->
          <div class="screen" #screen>
            @switch (variant().key) {
              @case ('A') {
                <div class="screen-a">
                  <p class="overline">Bienvenue à</p>
                  <h2 class="name">{{ name() }}</h2>
                  <div class="qr-tile"><app-proto-qr [url]="url()" /></div>
                  <p class="code">{{ code() }}</p>
                  <p class="address">{{ host() }}</p>
                </div>
              }
              @case ('B') {
                <div class="screen-b">
                  <div class="qr-tile"><app-proto-qr [url]="url()" /></div>
                  <div class="text">
                    <h2 class="name">{{ name() }}</h2>
                    <ol>
                      <li><b>Scanne</b> le QR code.</li>
                      <li>
                        <b>Suis bien les indications</b> de ton téléphone, pour profiter de toutes
                        les fonctions de l'application.
                      </li>
                      <li>
                        <b>Choisis ton pseudo</b>, puis inscris-toi aux parties auxquelles tu
                        aimerais jouer.
                      </li>
                    </ol>
                    <div class="fallback">
                      <p class="label">Tu n'arrives pas à lire le QR code&nbsp;?</p>
                      <p>Va sur <b>{{ host() }}</b> et tape le code</p>
                      <p class="code">{{ code() }}</p>
                    </div>
                  </div>
                </div>
              }
              @case ('C') {
                <div class="screen-c">
                  <div class="left"><div class="qr-tile"><app-proto-qr [url]="url()" /></div></div>
                  <div class="right">
                    <p class="overline">Histoires de Chimères</p>
                    <h2 class="name">{{ name() }}</h2>
                    <ol>
                      <li>Scanne le QR code.</li>
                      <li>Sur iPhone, ajoute l'application à l'écran d'accueil.</li>
                      <li>Choisis ton pseudo.</li>
                    </ol>
                    <p class="label">Pas de QR code&nbsp;? {{ host() }}, code</p>
                    <p class="code">{{ code() }}</p>
                  </div>
                </div>
              }
            }
          </div>
        </figure>
      </div>

      <nav class="proto-switcher" aria-label="Variantes du prototype">
        <button type="button" (click)="cycle(-1)" aria-label="Variante précédente">←</button>
        <span>{{ variant().key }} ({{ variant().name }})</span>
        <button type="button" (click)="cycle(1)" aria-label="Variante suivante">→</button>
      </nav>
    </div>
  `,
  styles: `
    /* ---------- page ---------- */
    .proto-page {
      padding: var(--space-l) var(--space-xl) 6rem;
    }
    .proto-toolbar {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      margin-bottom: var(--space-l);
    }
    .proto-help {
      color: var(--text-muted);
    }
    .proto-actions {
      display: flex;
      gap: var(--space-s);
      align-items: center;
      button {
        padding: var(--space-xs) var(--space-m);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        background: var(--surface-3);
        color: var(--text);
        cursor: pointer;
      }
      button:first-child {
        background: var(--accent);
        color: var(--on-accent);
        border-color: var(--accent);
      }
      a {
        color: var(--text-muted);
        font-size: var(--font-size-meta);
      }
    }
    .proto-previews {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xl);
      align-items: flex-start;
      figure {
        margin: 0;
      }
      figcaption {
        margin-bottom: var(--space-xs);
        font-family: var(--font-caps);
        font-size: var(--font-size-overline);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
    }
    .proto-sheet-frame {
      zoom: 0.5;
      outline: 2px solid var(--border);
    }
    .proto-switcher {
      position: fixed;
      bottom: 16px;
      left: 50%;
      translate: -50% 0;
      z-index: 1000;
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 6px 12px;
      border-radius: 999px;
      background: #fff;
      color: #000;
      font: 13px system-ui;
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.5);
      button {
        border: 0;
        background: #eee;
        border-radius: 999px;
        width: 28px;
        height: 28px;
        cursor: pointer;
      }
    }

    /* ---------- feuille commune ---------- */
    .sheet {
      box-sizing: border-box;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      position: relative;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    [data-variant='C'] .sheet {
      width: 297mm;
      height: 210mm;
    }
    .sheet ol {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* ---------- A : charbon, une colonne ---------- */
    .sheet-a {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10mm 12mm 8mm;
      background: var(--surface-0);
      color: var(--text);
      text-align: center;
      .engraving {
        position: absolute;
        width: 260mm;
        left: 50%;
        top: 30mm;
        translate: -50% 0;
        fill: none;
        stroke: var(--engraving);
        stroke-width: 0.4;
        z-index: 0;
      }
      > :not(.engraving) {
        position: relative;
      }
      .overline {
        font-family: var(--font-caps);
        font-size: 5mm;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .name {
        margin: 1mm 0 5mm;
        font-family: var(--font-display);
        font-size: 11mm;
        font-weight: normal;
        line-height: 1.1;
        color: var(--accent);
      }
      .qr-tile {
        width: 168mm;
        height: 168mm;
        padding: 0;
        border-radius: 4mm;
        overflow: hidden;
      }
      .code-line {
        display: flex;
        flex-direction: column;
        gap: 1mm;
        margin: 4mm 0 5mm;
        .label {
          font-family: var(--font-caps);
          font-size: 4mm;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .code {
          font-family: var(--font-caps);
          font-size: 13mm;
          letter-spacing: 0.3em;
          color: var(--accent);
        }
      }
      .steps {
        counter-reset: step;
        display: flex;
        flex-direction: column;
        gap: 2.5mm;
        text-align: left;
        font-size: 5mm;
        li {
          counter-increment: step;
          display: flex;
          gap: 3mm;
        }
        li::before {
          content: counter(step);
          flex: none;
          width: 7mm;
          height: 7mm;
          border-radius: 50%;
          background: var(--accent);
          color: var(--on-accent);
          display: grid;
          place-items: center;
          font-family: var(--font-caps);
          font-size: 4mm;
        }
      }
      .address {
        margin-top: auto;
        font-size: 4.5mm;
        color: var(--text-muted);
      }
      .by {
        margin-top: 1mm;
        font-size: 3.5mm;
        color: var(--text-muted);
      }
    }

    /* ---------- B : papier clair ---------- */
    .sheet-b {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10mm 15mm 10mm;
      background: #fff;
      color: #111;
      border-top: 6mm solid var(--accent);
      .name {
        font-family: var(--font-display);
        font-weight: normal;
        font-size: 11mm;
        text-align: center;
        line-height: 1.1;
      }
      .subtitle {
        margin: 2mm 0 0;
        font-size: 4.5mm;
        color: #444;
      }
      .qr {
        width: 172mm;
        height: 172mm;
      }
      .code-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1mm;
        margin: 0 0 6mm;
        padding: 3mm 10mm;
        font-size: 4.5mm;
        text-align: center;
        border: 0.6mm solid #111;
        border-radius: 3mm;
        .label {
          font-weight: 600;
        }
        .code {
          font-family: var(--font-caps);
          font-size: 12mm;
          line-height: 1.1;
          letter-spacing: 0.25em;
        }
      }
      .steps {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6mm;
        margin-top: auto;
        font-size: 4.5mm;
        li {
          display: flex;
          flex-direction: column;
          gap: 2mm;
        }
        .num {
          font-family: var(--font-display);
          font-size: 12mm;
          line-height: 1;
          color: var(--accent);
        }
      }
    }

    /* ---------- C : paysage deux volets ---------- */
    .sheet-c {
      display: grid;
      grid-template-columns: 178mm 1fr;
      background: var(--surface-0);
      color: var(--text);
      .left {
        display: grid;
        place-items: center;
        background: #fff;
      }
      .qr {
        width: 172mm;
        height: 172mm;
      }
      .right {
        display: flex;
        flex-direction: column;
        gap: 5mm;
        padding: 16mm 12mm;
      }
      .overline {
        font-family: var(--font-caps);
        font-size: 3.5mm;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .name {
        font-family: var(--font-display);
        font-weight: normal;
        font-size: 10mm;
        line-height: 1.1;
        color: var(--accent);
      }
      .steps {
        counter-reset: step;
        display: flex;
        flex-direction: column;
        gap: 3mm;
        font-size: 4.5mm;
        li {
          counter-increment: step;
        }
        li::before {
          content: counter(step) '. ';
          color: var(--accent);
          font-family: var(--font-caps);
        }
      }
      .fallback {
        margin-top: auto;
        padding: 4mm;
        border: 0.3mm solid var(--border);
        border-radius: 3mm;
        background: var(--surface-2);
        font-size: 4mm;
        .label {
          font-weight: 600;
        }
        .code {
          font-family: var(--font-caps);
          font-size: 12mm;
          letter-spacing: 0.25em;
          color: var(--accent);
        }
      }
    }

    /* ---------- plein écran ---------- */
    .screen {
      width: 560px;
      aspect-ratio: 16 / 9;
      container-type: size;
      background: var(--surface-0);
      color: var(--text);
      outline: 2px solid var(--border);
      overflow: hidden;
    }
    .screen:fullscreen {
      width: 100vw;
      height: 100vh;
      aspect-ratio: auto;
      outline: none;
    }
    .screen ol {
      margin: 0;
      padding-left: 1.2em;
    }
    .screen .qr-tile {
      border-radius: 2cqmin;
      overflow: hidden;
    }
    .screen .name {
      font-family: var(--font-display);
      font-weight: normal;
      color: var(--accent);
      line-height: 1.1;
    }
    .screen .code {
      font-family: var(--font-caps);
      letter-spacing: 0.25em;
      color: var(--accent);
    }
    .screen .overline,
    .screen .label {
      font-family: var(--font-caps);
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--text-muted);
    }
    .screen .address {
      color: var(--text-muted);
    }

    .screen-a {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 1cqh;
      .overline {
        font-size: 2.4cqh;
      }
      .name {
        font-size: 6cqh;
      }
      .qr-tile {
        width: 62cqh;
        height: 62cqh;
      }
      .code {
        font-size: 9cqh;
        line-height: 1;
      }
      .address {
        font-size: 2.6cqh;
      }
    }

    .screen-b {
      height: 100%;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6cqw;
      align-items: center;
      padding: 0 6cqw;
      .qr-tile {
        width: 82cqh;
        height: 82cqh;
      }
      .text {
        display: flex;
        flex-direction: column;
        gap: 2cqh;
      }
      .name {
        font-size: 7cqh;
      }
      .fallback {
        margin-top: 2cqh;
        padding: 2cqh 3cqh;
        border: 1px solid var(--border);
        border-radius: 1.5cqh;
        background: var(--surface-2);
        font-size: 2.6cqh;
        .label {
          font-family: var(--font-ui);
          text-transform: none;
          letter-spacing: 0;
          font-weight: 600;
          color: var(--text);
        }
      }
      .code {
        font-size: 8cqh;
        line-height: 1.1;
      }
      ol {
        font-size: 3cqh;
        display: flex;
        flex-direction: column;
        gap: 1cqh;
      }
      .address {
        font-size: 2.6cqh;
      }
    }

    .screen-c {
      height: 100%;
      display: grid;
      grid-template-columns: 60% 1fr;
      .left {
        display: grid;
        place-items: center;
        background: #fff;
      }
      .qr-tile {
        width: 92cqh;
        height: 92cqh;
        border-radius: 0;
      }
      .right {
        display: flex;
        flex-direction: column;
        gap: 2.5cqh;
        justify-content: center;
        padding: 0 4cqw;
      }
      .overline {
        font-size: 2.2cqh;
      }
      .name {
        font-size: 6cqh;
      }
      ol {
        font-size: 3cqh;
        display: flex;
        flex-direction: column;
        gap: 1cqh;
      }
      .label {
        font-size: 2cqh;
        letter-spacing: 0.1em;
      }
      .code {
        font-size: 9cqh;
        line-height: 1;
      }
    }

    /* ---------- impression : la feuille seule, à taille réelle ---------- */
    @media print {
      app-rail,
      app-alert-stack,
      .proto-toolbar,
      .proto-switcher,
      .proto-previews figure:last-child,
      .proto-previews figcaption {
        display: none !important;
      }
      body,
      main,
      .proto-page {
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        background: none !important;
      }
      .proto-sheet-frame {
        zoom: 1;
        outline: none;
      }
    }
  `,
})
export class PosterPrototypePage {
  private readonly store = inject(ConventionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');

  private readonly key = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('variant') ?? 'A')),
    { initialValue: 'A' },
  );
  protected readonly variant = computed(
    () => VARIANTS.find((variant) => variant.key === this.key()) ?? VARIANTS[0],
  );

  protected readonly name = computed(() => this.store.value()?.name ?? 'Convention');
  protected readonly code = computed(() => this.store.value()?.presenceCode ?? '····');
  protected readonly host = computed(() => location.host);
  protected readonly url = computed(
    () => `${location.origin}/?${PRESENCE_CODE_PARAM}=${this.code()}`,
  );

  protected cycle(step: number): void {
    const index = VARIANTS.indexOf(this.variant());
    const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length];
    void this.router.navigate([], { queryParams: { variant: next.key }, replaceUrl: true });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') this.cycle(-1);
    if (event.key === 'ArrowRight') this.cycle(1);
  }

  protected print(): void {
    const style = document.createElement('style');
    style.textContent = `@page { size: A4 ${this.variant().orientation}; margin: 0; }`;
    document.head.append(style);
    window.print();
    style.remove();
  }

  protected fullscreen(): void {
    void this.screen().nativeElement.requestFullscreen();
  }
}
