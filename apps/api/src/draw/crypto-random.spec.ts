import { cryptoRandom } from './crypto-random.js';

describe('Source de hasard du tirage', () => {
  it('rend des nombres de [0, 1)', () => {
    for (let draw = 0; draw < 1000; draw++) {
      const value = cryptoRandom();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
