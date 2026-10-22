import { expect, test } from '../../fixtures.js';
import { loadFont } from '../fonts.js';

test('le back office est servi sous /gestion/', async ({ page }) => {
  await page.goto('/gestion');

  await expect(page).toHaveURL(/\/gestion\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Gestion — Histoires de Chimères',
  );
});

test('un lien profond retombe sur le back office', async ({ page }) => {
  await page.goto('/gestion/une/route');

  await expect(page).toHaveTitle('Gestion — Histoires de Chimères');
});

test('le back office sert ses polices sous /gestion/', async ({ page }) => {
  await page.goto('/gestion/');

  expect(await loadFont(page, 'Uncial Antiqua')).toBe(true);
  expect(await loadFont(page, 'Aldrich')).toBe(true);
});
