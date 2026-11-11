import { readIPhoneBrowser } from './iphone-browser';

describe('readIPhoneBrowser', () => {
  const iPhone = (suffix: string) =>
    `Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${suffix}`;

  it('reconnaît Safari', () => {
    expect(readIPhoneBrowser(iPhone('Version/18.6 Mobile/15E148 Safari/604.1'))).toBe('safari');
  });

  it('reconnaît Chrome', () => {
    expect(readIPhoneBrowser(iPhone('CriOS/140.0.0.0 Mobile/15E148 Safari/604.1'))).toBe('chrome');
  });

  it('reconnaît Firefox', () => {
    expect(readIPhoneBrowser(iPhone('FxiOS/140.0 Mobile/15E148 Safari/605.1.15'))).toBe('firefox');
  });

  it('prend le chemin de Safari pour un autre navigateur', () => {
    expect(readIPhoneBrowser(iPhone('EdgiOS/140.0 Mobile/15E148 Safari/605.1.15'))).toBe('safari');
  });
});
