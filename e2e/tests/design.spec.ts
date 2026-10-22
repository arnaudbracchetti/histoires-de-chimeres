import { expect, test, type Page } from '@playwright/test';

/** Charge une police de la charte dans la page et dit si elle a été trouvée. */
function loadFont(page: Page, family: string) {
  return page.evaluate(async (f) => (await document.fonts.load(`1em "${f}"`)).length > 0, family);
}

test("le front office sert ses polices et l'icône de PWA", async ({ page, baseURL }) => {
  const fonts: string[] = [];
  page.on('response', (response) => {
    if (response.url().endsWith('.woff2') && response.ok()) fonts.push(response.url());
  });
  await page.goto('/');

  expect(await loadFont(page, 'Uncial Antiqua')).toBe(true);
  expect(await loadFont(page, 'Aldrich')).toBe(true);
  // Hébergées avec l'application, jamais chargées depuis Google Fonts.
  expect(fonts).toHaveLength(2);
  for (const url of fonts) expect(new URL(url).origin).toBe(new URL(baseURL!).origin);

  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  const icon = manifest.icons.find(
    (i: { sizes: string; purpose: string }) => i.sizes === '512x512' && i.purpose === 'any',
  );
  const response = await page.request.get(`/${icon.src}`);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toBe('image/png');
});

test('le back office sert ses polices sous /gestion/', async ({ page }) => {
  await page.goto('/gestion/');

  expect(await loadFont(page, 'Uncial Antiqua')).toBe(true);
  expect(await loadFont(page, 'Aldrich')).toBe(true);
});
