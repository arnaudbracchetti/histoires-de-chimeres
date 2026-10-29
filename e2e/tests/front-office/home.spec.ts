import { expect, test } from '@playwright/test';
import {
  apiUrl,
  conventionEndpoints,
  PRESENCE_CODE_PARAM,
  type ConventionDto,
} from '@chimeres/contract';
import { loadFont } from '../fonts.js';

test('le front office demande le pseudo, avec le code de présence', async ({ page }) => {
  const convention = (await (
    await page.request.get(apiUrl(conventionEndpoints.read))
  ).json()) as ConventionDto;

  await page.goto(`/?${PRESENCE_CODE_PARAM}=${convention.presenceCode}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton pseudo');
});

test('un lien profond retombe sur le front office', async ({ page }) => {
  await page.goto('/une/route');

  await expect(page).toHaveTitle('Histoires de Chimères');
});

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
