import { Component, computed, input, signal } from '@angular/core';
import { initialOf } from '@chimeres/design';

/** Vignette carrée (32 et 44 px), carte 3:2 du front office, bandeau 4:1 de la page d'un scénario. */
export type IllustrationFormat = 'thumb' | 'card' | 'banner';

/**
 * Cadre de chaque format, avec sa version du motif (simplifiée pour la vignette), dans les unités
 * du motif (un symbole de 200 de côté) : le motif est centré en (x, y) à l'échelle `scale`, la
 * lettrine en son centre (docs/design/identite.md, Placement).
 */
const FRAMES = {
  thumb: {
    symbol: 'engraving-small',
    viewBox: '-100 -100 200 200',
    x: 0,
    y: 0,
    scale: 1,
    letter: 130,
  },
  card: {
    symbol: 'engraving-initial',
    viewBox: '-150 -100 300 200',
    x: 70,
    y: -25,
    scale: 1.3,
    letter: 120,
  },
  banner: {
    symbol: 'engraving-initial',
    viewBox: '-200 -50 400 100',
    x: 130,
    y: 0,
    scale: 1,
    letter: 112,
  },
} as const;

/**
 * Image d'un scénario, ou à défaut son illustration par défaut (PR-7), qui remplace aussi une image
 * qui ne se charge pas, sans icône d'image cassée : la lettrine de son titre,
 * article ignoré, en Uncial Antiqua, dans le motif gravé (simplifié pour les vignettes). Décorative,
 * masquée aux lecteurs d'écran : le titre est toujours écrit à côté. Le parent en fixe la largeur.
 * Dupliqué dans le front office (ADR 0006, docs/design/ecriture-css.md).
 */
@Component({
  selector: 'app-scenario-illustration',
  host: { '[class]': 'format()' },
  template: `
    @if (shownUrl(); as url) {
      <img [src]="url" alt="" (error)="failedUrl.set(url)" />
    } @else {
      <svg
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
        [attr.viewBox]="frame().viewBox"
      >
        <use
          [attr.href]="'illustration.svg#' + frame().symbol"
          [attr.x]="frame().x - 100 * frame().scale"
          [attr.y]="frame().y - 100 * frame().scale"
          [attr.width]="200 * frame().scale"
          [attr.height]="200 * frame().scale"
        />
        <text
          [attr.x]="frame().x"
          [attr.y]="frame().y"
          [attr.font-size]="frame().letter"
          text-anchor="middle"
          dominant-baseline="central"
        >
          {{ initial() }}
        </text>
      </svg>
    }
  `,
  styles: `
    @layer components {
      :host {
        display: block;
        overflow: hidden;
        background: var(--surface-2);
      }

      :host(.thumb) {
        aspect-ratio: 1;
        border-radius: var(--radius-control);
        background: var(--surface-3);
      }

      :host(.card) {
        aspect-ratio: 3 / 2;
      }

      :host(.banner) {
        aspect-ratio: 4 / 1;
      }

      img,
      svg {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      text {
        fill: var(--initial);
        font-family: var(--font-display);
      }
    }
  `,
})
export class ScenarioIllustration {
  readonly title = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly format = input<IllustrationFormat>('thumb');

  /** L'URL qui n'a pas pu se charger : une autre URL retente. */
  protected readonly failedUrl = signal<string | null>(null);
  protected readonly shownUrl = computed(() => {
    const url = this.imageUrl();
    return url !== this.failedUrl() ? url : null;
  });

  protected readonly frame = computed(() => FRAMES[this.format()]);
  /** Vide tant que le titre l'est : le motif reste seul. */
  protected readonly initial = computed(() => (this.title().trim() ? initialOf(this.title()) : ''));
}
