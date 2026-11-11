import { Component, computed, input } from '@angular/core';
import { buildQrCodeSvg } from '@chimeres/design/qr-code';

/**
 * Le QR code d'une adresse, modules à l'encre sur papier, marge comprise : le SVG prend toute la
 * place de son hôte, carré. Le tracé vient de `@chimeres/design/qr-code`, sans HTML injecté.
 * L'hôte porte `--qr-symbol-share`, la part du symbole dans son côté : pour un symbole de côté
 * `T`, l'hôte mesure `calc(T / var(--qr-symbol-share))`.
 */
@Component({
  selector: 'app-qr-code',
  host: { '[style.--qr-symbol-share]': 'svg().symbolShare' },
  template: `
    <svg
      role="img"
      [attr.aria-label]="label()"
      [attr.viewBox]="svg().viewBox"
      [attr.shape-rendering]="svg().shapeRendering"
    >
      <rect class="paper" width="100%" height="100%" />
      <path class="ink" [attr.d]="svg().path" />
    </svg>
  `,
  styles: `
    @layer components {
      :host {
        display: block;
        aspect-ratio: 1;
      }

      svg {
        display: block;
        width: 100%;
        height: 100%;
      }

      .paper {
        fill: var(--paper);
      }

      .ink {
        fill: var(--ink);
      }
    }
  `,
})
export class QrCode {
  readonly url = input.required<string>();
  /** Le nom accessible du QR code. */
  readonly label = input.required<string>();
  protected readonly svg = computed(() => buildQrCodeSvg(this.url()));
}
