import type { RandomSource } from '@chimeres/domain';

/**
 * Une source de hasard à graine (mulberry32) : la même graine rend toujours la même suite. Pour
 * rejouer un tirage dans les tests ; en production, le hasard vient de `node:crypto`.
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
