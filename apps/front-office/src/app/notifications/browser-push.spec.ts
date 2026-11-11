import { readIOSVersion } from './browser-push';

describe('readIOSVersion', () => {
  it('lit la version d’iOS dans Safari sur iPhone', () => {
    const safari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1';

    expect(readIOSVersion(safari)).toEqual([16, 3]);
  });

  it('lit la version d’iOS dans Chrome sur iPhone', () => {
    const chrome =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1';

    expect(readIOSVersion(chrome)).toEqual([18, 6]);
  });

  it('ne lit rien sur Android', () => {
    const android =
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

    expect(readIOSVersion(android)).toBeNull();
  });
});
