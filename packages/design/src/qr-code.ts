import { correction, generate } from 'lean-qr';

/** La zone vierge que la norme impose autour du symbole, en modules. */
const MARGIN = 4;

/**
 * Le QR code d'un texte, à placer dans un `<svg>` sur fond blanc : sans HTML à injecter. Les
 * coordonnées sont en modules, marge comprise.
 */
export type QrCodeSvg = {
  viewBox: string;
  /** Le tracé des modules noirs : un rectangle par suite de modules noirs d'une ligne. */
  path: string;
  /** Sans anticrénelage : aucun liseré clair entre deux modules voisins, à tout agrandissement. */
  shapeRendering: 'crispEdges';
  /**
   * La part du symbole dans le côté, sans la marge : pour un symbole de côté `T`, le SVG mesure
   * `T / symbolShare`.
   */
  symbolShare: number;
};

/**
 * Le QR code du texte, en correction M, avec la marge de 4 modules de la norme. Voir docs/research/qr-code-affiche.md.
 */
export function buildQrCodeSvg(text: string): QrCodeSvg {
  const code = generate(text, {
    minCorrectionLevel: correction.M,
    maxCorrectionLevel: correction.M,
  });
  let path = '';
  for (let y = 0; y < code.size; y++) {
    let x = 0;
    while (x < code.size) {
      if (!code.get(x, y)) {
        x++;
        continue;
      }
      const start = x;
      while (x < code.size && code.get(x, y)) x++;
      path += `M${start + MARGIN} ${y + MARGIN}h${x - start}v1h-${x - start}z`;
    }
  }
  const side = code.size + 2 * MARGIN;
  return {
    viewBox: `0 0 ${side} ${side}`,
    path,
    shapeRendering: 'crispEdges',
    symbolShare: code.size / side,
  };
}
