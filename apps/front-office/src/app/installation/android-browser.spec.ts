import { readAndroidBrowser } from './android-browser';

describe('readAndroidBrowser', () => {
  const chromium = (suffix: string) =>
    `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) ${suffix}`;

  it('reconnaît Chrome', () => {
    expect(readAndroidBrowser(chromium('Chrome/140.0.0.0 Mobile Safari/537.36'))).toBe('chrome');
  });

  it('reconnaît Samsung Internet, qui écrit aussi « Chrome »', () => {
    expect(
      readAndroidBrowser(chromium('SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36')),
    ).toBe('samsung');
  });

  it('reconnaît Firefox', () => {
    expect(
      readAndroidBrowser('Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0'),
    ).toBe('firefox');
  });

  it('prend le chemin de Chrome pour un autre navigateur', () => {
    expect(
      readAndroidBrowser(chromium('Chrome/140.0.0.0 Mobile Safari/537.36 EdgA/140.0.0.0')),
    ).toBe('chrome');
  });
});
