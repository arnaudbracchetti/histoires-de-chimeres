import { correction, generate } from 'lean-qr';
import { describe, expect, it } from 'vitest';
import { buildQrCodeSvg } from './qr-code.js';

const URL = 'https://test2.nekbet.fr/?code=ABCD';
const MARGIN = 4;

/** Les modules noirs que couvre le tracé, sous la forme `x,y`. */
function readDarkModules(path: string): Set<string> {
  const dark = new Set<string>();
  for (const [, x, y, width] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    for (let dx = 0; dx < Number(width); dx++) dark.add(`${Number(x) + dx},${y}`);
  }
  return dark;
}

describe('buildQrCodeSvg', () => {
  it('trace les modules de lean-qr en correction M, décalés de la marge de 4 modules', () => {
    const code = generate(URL, {
      minCorrectionLevel: correction.M,
      maxCorrectionLevel: correction.M,
    });
    const expected = new Set<string>();
    for (let y = 0; y < code.size; y++) {
      for (let x = 0; x < code.size; x++) {
        if (code.get(x, y)) expected.add(`${x + MARGIN},${y + MARGIN}`);
      }
    }

    expect(readDarkModules(buildQrCodeSvg(URL).path)).toEqual(expected);
  });

  it('compte la marge dans son côté', () => {
    // Version 3 : 29 modules, plus 4 de chaque côté.
    expect(buildQrCodeSvg(URL).viewBox).toBe('0 0 37 37');
  });

  it('ne trace que des rectangles, sans rien d’autre', () => {
    const { path } = buildQrCodeSvg(URL);

    expect(path.replace(/M\d+ \d+h(\d+)v1h-\1z/g, '')).toBe('');
  });

  it('garde des bords nets à tout agrandissement', () => {
    expect(buildQrCodeSvg(URL).shapeRendering).toBe('crispEdges');
  });
});
